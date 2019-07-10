import {exampleSetup, buildMenuItems} from "prosemirror-example-setup"
import {Step} from "prosemirror-transform"
import {TextSelection, Plugin, EditorState} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {collab, receiveTransaction, sendableSteps, getVersion} from "prosemirror-collab"
import {MenuItem} from "prosemirror-menu"
import crel from "crel"

// import {schema} from "./collab/schema"
import {GET, POST} from "./collab/client/http"
import {Reporter} from "./collab/client/reporter"
import {PM_BT_G_COMMENTS_ARRAY, commentPlugin, commentUI, addAnnotation, annotationIcon} from "./comment"

import {schema} from "prosemirror-schema-basic"
import {DOMParser} from "prosemirror-model";

export let btpm_comment_count = 0;

const report = new Reporter()


/** 커스텀 플러그인 **/
let eventPlugin = function(dispatch){
    return new Plugin({
      props: {
        handleKeyDown(view, event) {
          return false // We did not handle this
        },
        handleClick(view, post, event){
            return false
        },
        decorations(state) {
            return false
        }
      }
    })
}


/* START TRACK CHANGES**************************/

    class Span {
        constructor(from, to, commit) {
            this.from = from;
            this.to = to;
            this.commit = commit
        }
    }

    class Commit {
        constructor(message, time, steps, maps, hidden) {
            this.message = message
            this.time = time
            this.steps = steps
            this.maps = maps
            this.hidden = hidden
        }
    }

    class TrackState {
        constructor(blameMap, commits, uncommittedSteps, uncommittedMaps) {
            // The blame map is a data structure that lists a sequence of
            // document ranges, along with the commit that inserted them. This
            // can be used to, for example, highlight the part of the document
            // that was inserted by a commit.
            this.blameMap = blameMap
            // The commit history, as an array of objects.
            this.commits = commits
            // Inverted steps and their maps corresponding to the changes that
            // have been made since the last commit.
            this.uncommittedSteps = uncommittedSteps
            this.uncommittedMaps = uncommittedMaps
        }

        // Apply a transform to this state
        applyTransform(transform) {
            // Invert the steps in the transaction, to be able to save them in
            // the next commit
            let inverted =
                transform.steps.map((step, i) => step.invert(transform.docs[i]))
            let newBlame = updateBlameMap(this.blameMap, transform, this.commits.length)
            // Create a new state—since these are part of the editor state, a
            // persistent data structure, they must not be mutated.
            return new TrackState(newBlame, this.commits,
                this.uncommittedSteps.concat(inverted),
                this.uncommittedMaps.concat(transform.mapping.maps))
        }

        // When a transaction is marked as a commit, this is used to put any
        // uncommitted steps into a new commit.
        applyCommit(message, time) {
            if (this.uncommittedSteps.length == 0) return this
            let commit = new Commit(message, time, this.uncommittedSteps,
                this.uncommittedMaps)
            return new TrackState(this.blameMap, this.commits.concat(commit), [], [])
        }
    }

        function updateBlameMap(map, transform, id) {
        let result = [], mapping = transform.mapping
        for (let i = 0; i < map.length; i++) {
            let span = map[i]
            let from = mapping.map(span.from, 1), to = mapping.map(span.to, -1)
            if (from < to) result.push(new Span(from, to, span.commit))
        }

        for (let i = 0; i < mapping.maps.length; i++) {
            let map = mapping.maps[i], after = mapping.slice(i + 1)
            map.forEach((_s, _e, start, end) => {
                insertIntoBlameMap(result, after.map(start, 1), after.map(end, -1), id)
            })
        }

        return result
    }

    function insertIntoBlameMap(map, from, to, commit) {
        if (from >= to) return
        let pos = 0, next
        for (; pos < map.length; pos++) {
            next = map[pos]
            if (next.commit == commit) {
                if (next.to >= from) break
            } else if (next.to > from) { // Different commit, not before
                if (next.from < from) { // Sticks out to the left (loop below will handle right side)
                    let left = new Span(next.from, from, next.commit)
                    if (next.to > to) map.splice(pos++, 0, left)
                    else map[pos++] = left
                }
                break
            }
        }

        while (next = map[pos]) {
            if (next.commit == commit) {
                if (next.from > to) break
                from = Math.min(from, next.from)
                to = Math.max(to, next.to)
                map.splice(pos, 1)
            } else {
                if (next.from >= to) break
                if (next.to > to) {
                    map[pos] = new Span(to, next.to, next.commit)
                    break
                } else {
                    map.splice(pos, 1)
                }
            }
        }

        map.splice(pos, 0, new Span(from, to, commit))
    }


    const trackPlugin = new Plugin({
        state: {
            init(_, instance) {
                return new TrackState([new Span(0, instance.doc.content.size, null)], [], [], [])
            },
            apply(tr, tracked) {
                if (tr.docChanged) tracked = tracked.applyTransform(tr)
                let commitMessage = tr.getMeta(this)
                if (commitMessage) tracked = tracked.applyCommit(commitMessage, new Date(tr.time))
                return tracked
            }
        }
    })

    function elt(name, attrs, ...children) {
        let dom = document.createElement(name)
        if (attrs) for (let attr in attrs) dom.setAttribute(attr, attrs[attr])
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            dom.appendChild(typeof child == "string" ? document.createTextNode(child) : child)
        }
        return dom
    }

    const highlightPlugin = new Plugin({
        state: {
            init() {
                return {deco: DecorationSet.empty, commit: null}
            },
            apply(tr, prev, oldState, state) {
                let highlight = tr.getMeta(this)
                if (highlight && highlight.add != null && prev.commit != highlight.add) {
                    let tState = trackPlugin.getState(oldState)
                    let decos = tState.blameMap
                        .filter(span => tState.commits[span.commit] == highlight.add)
                        .map(span => Decoration.inline(span.from, span.to, {class: "blame-marker"}))
                    return {deco: DecorationSet.create(state.doc, decos), commit: highlight.add}
                } else if (highlight && highlight.clear != null && prev.commit == highlight.clear) {
                    return {deco: DecorationSet.empty, commit: null}
                } else if (tr.docChanged && prev.commit) {
                    return {deco: prev.deco.map(tr.mapping, tr.doc), commit: prev.commit}
                } else {
                    return prev
                }
            }
        },
        props: {
            decorations(state) {
                return this.getState(state).deco
            }
        }
    })

    // let state = EditorState.create({
    //     schema,
    //     doc: DOMParser.fromSchema(schema).parse(document.querySelector("#"+content_id)) ,
    //     plugins: exampleSetup({schema}).concat(trackPlugin, highlightPlugin)
    // }), view

    let lastRendered = null

    function dispatch(tr) {
        connection.view.state = connection.view.state.apply(tr)
        view.updateState(connection.view.state)
        setDisabled(connection.view.state)
        renderCommits(connection.view.state, connection.dispatch)
    }

    // view = window.view = new EditorView(document.querySelector("#editor"), {state, dispatchTransaction: dispatch})
    // // dispatch(state.tr.insertText("Type something, and then commit it."))
    // dispatch(state.tr.setMeta(trackPlugin, "Initial commit"))


    function setDisabled(state) {
        let input = document.querySelector("#message")
        let button = document.querySelector("#commitbutton")
        input.disabled = button.disabled = trackPlugin.getState(state).uncommittedSteps.length == 0
    }

    function doCommit(message) {
        dispatch(connection.view.state.tr.setMeta(trackPlugin, message))
    }

    function renderCommits(state, dispatch) {
        let curState = trackPlugin.getState(state)
        if (lastRendered == curState) return
        lastRendered = curState

        let out = document.querySelector("#commits")
        out.textContent = ""
        let commits = curState.commits
        commits.forEach(commit => {
            let node = elt(
                "div",
                {class: "commit"},
                elt("span",
                    {class: "commit-time"},
                    commit.time.getHours() + ":" + (commit.time.getMinutes() < 10 ? "0" : "")+ commit.time.getMinutes()  + ":" + (commit.time.getSeconds() < 10 ? "0" : "") + commit.time.getSeconds()
                ),
                "\u00a0 " + commit.message + "\u00a0 ",
                // elt("button", {class: "commit-revert"}, "revert")
            )
            node.lastChild.addEventListener("click", () => revertCommit(commit))
            node.addEventListener("mouseover", e => {
                if (!node.contains(e.relatedTarget))
                    dispatch(state.tr.setMeta(highlightPlugin, {add: commit}))
            })
            node.addEventListener("mouseout", e => {
                if (!node.contains(e.relatedTarget))
                    dispatch(state.tr.setMeta(highlightPlugin, {clear: commit}))
            })
            out.appendChild(node)
        })
    }

    function revertCommit(commit) {
        let trackState = trackPlugin.getState(state)
        let index = trackState.commits.indexOf(commit)
        // If this commit is not in the history, we can't revert it
        if (index == -1) return

        // Reverting is only possible if there are no uncommitted changes
        if (trackState.uncommittedSteps.length)
            return alert("Commit your changes first!")

        // This is the mapping from the document as it was at the start of
        // the commit to the current document.
        let remap = new Mapping(trackState.commits.slice(index)
            .reduce((maps, c) => maps.concat(c.maps), []))
        let tr = state.tr
        // Build up a transaction that includes all (inverted) steps in this
        // commit, rebased to the current document. They have to be applied
        // in reverse order.
        for (let i = commit.steps.length - 1; i >= 0; i--) {
            // The mapping is sliced to not include maps for this step and the
            // ones before it.
            let remapped = commit.steps[i].map(remap.slice(i + 1))
            if (!remapped) continue
            let result = tr.maybeStep(remapped)
            // If the step can be applied, add its map to our mapping
            // pipeline, so that subsequent steps are mapped over it.
            if (result.doc) remap.appendMap(remapped.getMap(), i)
        }
        // Add a commit message and dispatch.
        if (tr.docChanged)
            dispatch(tr.setMeta(trackPlugin, `Revert '${commit.message}'`))
    }

// }

    document.querySelector("#commit").addEventListener("submit", e => {
        e.preventDefault()
        doCommit(e.target.elements.message.value || "Unnamed")
        e.target.elements.message.value = ""
        connection.view.focus()
    })

    function findInBlameMap(pos, state) {
        let map = trackPlugin.getState(state).blameMap
        for (let i = 0; i < map.length; i++)
            if (map[i].to >= pos && map[i].commit != null)
                return map[i].commit
    }

    document.querySelector("#blame").addEventListener("mousedown", e => {
        e.preventDefault()
        let pos = e.target.getBoundingClientRect()
        let commitID = findInBlameMap(state.selection.head, state)
        let commit = commitID != null && trackPlugin.getState(state).commits[commitID]
        let node = elt("div", {class: "blame-info"},
            commitID != null ? elt("span", null, "It was: ", elt("strong", null, commit ? commit.message : "Uncommitted"))
                : "No commit found")
        node.style.right = (document.body.clientWidth - pos.right) + "px"
        node.style.top = (pos.bottom + 2) + "px"
        document.body.appendChild(node)
        setTimeout(() => document.body.removeChild(node), 2000)
    })

/* END of TRACK CHANGES**************************/







function badVersion(err) {
  return err.status == 400 && /invalid version/i.test(err)
}

class State {
  constructor(edit, comm) {
    this.edit = edit
    this.comm = comm
  }
}

class EditorConnection {
  constructor(report, url, target_id, _comment_target_id) {
    this.report = report
    this.url = url
    this.state = new State(null, "start")
    this.request = null
    this.backOff = 0
    this.view = null
    this.dispatch = this.dispatch.bind(this)
    this.start(target_id, _comment_target_id)
  }

  // All state changes go through this
  dispatch(action) {
console.log('[action.target_id] >> ' + action.target_id);
console.log('dispatch(action.type) ' + action.type);
    let newEditState = null
    if (action.type == "loaded") {
        // alert('loaded ' + action.comments.comments.length);
      info.users.textContent = userString(action.users) // FIXME ewww
      let editState = EditorState.create({
        doc: action.doc,
        plugins: exampleSetup({schema, history: false, menuContent: menu.fullMenu}).concat([
          history({preserveItems: true}),
          collab({version: action.version}),
          commentPlugin,
          commentUI( transaction => this.dispatch({type: "transaction", transaction}) ),
          eventPlugin( transaction => this.dispatch({type: "transaction", transaction}) ),
          trackPlugin, highlightPlugin
        ]),
        comments: action.comments
      })
      this.state = new State(editState, "poll")
      this.poll()
    } else if (action.type == "restart") {
      this.state = new State(null, "start")
      this.start()
    } else if (action.type == "poll") {
      this.state = new State(this.state.edit, "poll")
      this.poll()
    } else if (action.type == "recover") {
      if (action.error.status && action.error.status < 500) {
        this.report.failure(action.error)
        this.state = new State(null, null)
      } else {
        this.state = new State(this.state.edit, "recover")
        this.recover(action.error)
      }
    } else if (action.type == "transaction") {
      newEditState = this.state.edit.apply(action.transaction)
    }

    if (newEditState) {
        // console.log(newEditState + " << 디스패치!! this.state.comm : " + this.state.comm
        //     +", action.requestDone : " + action.requestDone + ', this.state.comm : ' + this.state.comm);
      let sendable;

      //1. 4000 사이즈 보기
      if (newEditState.doc.content.size > 40000) {
        if (this.state.comm != "detached") this.report.failure("Document too big. Detached.")
        this.state = new State(newEditState, "detached")
          console.log('detached !!!');
      } else if ((this.state.comm == "poll" || action.requestDone) && (sendable = this.sendable(newEditState))) {
      //2. poll  상태
        this.closeRequest()
        this.state = new State(newEditState, "send")
        this.send(newEditState, sendable)
          console.log('poll !!!');
      } else if (action.requestDone) {
          //3. 리퀘스트 done
        this.state = new State(newEditState, "poll")
        this.poll()
      } else {
          //알수없음
        this.state = new State(newEditState, this.state.comm)
      }
    }

    // Sync the editor with this.state.edit
    if (this.state.edit) {
      if (this.view) {
        this.view.updateState(this.state.edit)
      }else{
        if(action.target_id){
            //do nothing
        }else{
            alert('타겟ID 없음 : ' + action.type);
        }
        this.setView(new EditorView(document.querySelector("#" + action.target_id), {
          state: this.state.edit,
          dispatchTransaction: transaction => this.dispatch({type: "transaction", transaction})
        }))
      }
    } else this.setView(null)


    /** 코멘트 커스터마이징 우측 창에 따로 보이게 하기 START */
    // from, to ,text, id
    if(action.comments && action.comments.comments.length>0){
        // handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY, action.comment_target_id);
        // handle_comment_draw(action.comments.comments, action.comment_target_id)
        handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY, action.comment_target_id);
    }


    /** 코멘트 커스터마이징 우측 창에 따로 보이게 하기 END */
  }

  // Load the document from the server and start up
  start(target_id, _comment_target_id) {
    this.run(GET(this.url)).then(data => {
      data = JSON.parse(data)
      this.report.success()
      this.backOff = 0
      this.dispatch({
          target_id:target_id,
          comment_target_id:_comment_target_id,
          type: "loaded",
                     doc: schema.nodeFromJSON(data.doc),
                     version: data.version,
                     users: data.users,
                     comments: {version: data.commentVersion, comments: data.comments}})
    }, err => {
        alert('start() err ' + err);
      // this.report.failure(err)
    })
  }

  // Send a request for events that have happened since the version
  // of the document that the client knows about. This request waits
  // for a new version of the document to be created if the client
  // is already up-to-date.
  poll() {
    let query = "version=" + getVersion(this.state.edit) + "&commentVersion=" + commentPlugin.getState(this.state.edit).version
    this.run(GET(this.url + "/events?" + query)).then(data => {
      this.report.success()
      data = JSON.parse(data)
      this.backOff = 0
      if (data.steps && (data.steps.length || data.comment.length)) {
        let tr = receiveTransaction(this.state.edit, data.steps.map(j => Step.fromJSON(schema, j)), data.clientIDs)
        tr.setMeta(commentPlugin, {type: "receive", version: data.commentVersion, events: data.comment, sent: 0})
        this.dispatch({type: "transaction", transaction: tr, requestDone: true})
      } else {
        this.poll()
      }
      info.users.textContent = userString(data.users)
    }, err => {
      if (err.status == 410 || badVersion(err)) {
        // Too far behind. Revert to server state
        this.report.failure(err)
        this.dispatch({type: "restart"})
      } else if (err) {
        this.dispatch({type: "recover", error: err})
      }
    })
  }

  sendable(editState) {
    let steps = sendableSteps(editState)
    let comments = commentPlugin.getState(editState).unsentEvents()

     handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY) //갱신
    if (steps || comments.length) return {steps, comments}
  }

  // Send the given steps to the server
  send(editState, {steps, comments}) {
    let json = JSON.stringify({version: getVersion(editState),
                               steps: steps ? steps.steps.map(s => s.toJSON()) : [],
                               clientID: steps ? steps.clientID : 0,
                               comment: comments || []})
    this.run(POST(this.url + "/events", json, "application/json")).then(data => {
      this.report.success()
      this.backOff = 0
      let tr = steps
          ? receiveTransaction(this.state.edit, steps.steps, repeat(steps.clientID, steps.steps.length))
          : this.state.edit.tr
      tr.setMeta(commentPlugin, {type: "receive", version: JSON.parse(data).commentVersion, events: [], sent: comments.length})
      this.dispatch({type: "transaction", transaction: tr, requestDone: true})
    }, err => {
      if (err.status == 409) {
        // The client's document conflicts with the server's version.
        // Poll for changes and then try again.
        this.backOff = 0
        this.dispatch({type: "poll"})
      } else if (badVersion(err)) {
        this.report.failure(err)
        this.dispatch({type: "restart"})
      } else {
        this.dispatch({type: "recover", error: err})
      }
    })
  }

  // Try to recover from an error
  recover(err) {
    let newBackOff = this.backOff ? Math.min(this.backOff * 2, 6e4) : 200
    if (newBackOff > 1000 && this.backOff < 1000) this.report.delay(err)
    this.backOff = newBackOff
    setTimeout(() => {
      if (this.state.comm == "recover") this.dispatch({type: "poll"})
    }, this.backOff)
  }

  closeRequest() {
    if (this.request) {
      this.request.abort()
      this.request = null
    }
  }

  run(request) {
    return this.request = request
  }

  close() {
    this.closeRequest()
    this.setView(null)
  }

  setView(view) {
    if (this.view) this.view.destroy()
    this.view = window.view = view
  }
}

function repeat(val, n) {
  let result = []
  for (let i = 0; i < n; i++) result.push(val)
  return result
}

const annotationMenuItem = new MenuItem({
  title: "코멘트입력",
  run: addAnnotation,
  select: state => addAnnotation(state),
  icon: annotationIcon,
  class : "btpm_add_comment_menu"

})
let menu = buildMenuItems(schema)
menu.fullMenu[0].push(annotationMenuItem)

let info = {
  name: document.querySelector("#docname"),
  users: document.querySelector("#users")
}
document.querySelector("#changedoc").addEventListener("click", e => {
  GET("/collab-backend/docs/").then(data => showDocList(e.target, JSON.parse(data)),
                                    err => report.failure(err))
})

function userString(n) {
  return "(" + n + " user" + (n == 1 ? "" : "s") + ")"
}

let docList
function showDocList(node, list) {
  if (docList) docList.parentNode.removeChild(docList)

  let ul = docList = document.body.appendChild(crel("ul", {class: "doclist"}))
  list.forEach(doc => {
    ul.appendChild(crel("li", {"data-name": doc.id},
                        doc.id + " " + userString(doc.users)))
  })
  ul.appendChild(crel("li", {"data-new": "true", style: "border-top: 1px solid silver; margin-top: 2px"},
                      "Create a new document"))

  let rect = node.getBoundingClientRect()
  ul.style.top = (rect.bottom + 10 + pageYOffset - ul.offsetHeight) + "px"
  ul.style.left = (rect.left - 5 + pageXOffset) + "px"

  ul.addEventListener("click", e => {
    if (e.target.nodeName == "LI") {
      ul.parentNode.removeChild(ul)
      docList = null
      if (e.target.hasAttribute("data-name"))
        location.hash = "#edit-" + encodeURIComponent(e.target.getAttribute("data-name"))
      else
        newDocument()
    }
  })
}
document.addEventListener("click", () => {
  if (docList) {
    docList.parentNode.removeChild(docList)
    docList = null
  }
})

function newDocument() {
  let name = prompt("Name the new document", "")
  if (name)
    location.hash = "#edit-" + encodeURIComponent(name)
}

let connection = null

function connectFromHash() {
    alert('connectFromHash');
  let isID = /^#edit-(.+)/.exec(location.hash)
  if (isID) {
    if (connection) connection.close()
    info.name.textContent = decodeURIComponent(isID[1])
    connection = window.connection = new EditorConnection(report, "/docs/Example") // + isID[1]  <-- 이거 지네 데모에만 필요한거
    // connection = window.connection = new EditorConnection(report, "/collab-backend/docs") // + isID[1]  <-- 이거 지네 데모에만 필요한거
alert('connection.view => ' + connection.view);
    if(connection.view) {
        connection.request.then(() => connection.view.focus())
    }
    return true
  }
}

// addEventListener("hashchange", connectFromHash)
// connectFromHash() || (location.hash = "#edit-Example")

/** index.js 외부에서 호출할때 */
export function editorInit(target_id, content_id, _comment_target_id){
    connection = window.connection = new EditorConnection(report, "/docs/Example", target_id) // + isID[1]  <-- 이거 지네 데모에만 필요한거
}

// 코멘트판넬에서 div 클릭 시
function onCommentBtClicked(id_suffix, _offset_from){
    //에디터 안에서 바꿔봄
    let _classesEle = document.getElementsByClassName('_comment_btpm_' + id_suffix);
    let _top_pos = 0;
    for(var i=0; i<_classesEle.length; _classesEle++){
        _top_pos = _classesEle[i].offsetTop;
        //break;
        // _classesEle[i].blur();
        // _classesEle[i].focus();
        // _classesEle[i].click();
        var _target = _classesEle[i]
        setTimeout( function() {
            _target.scrollIntoView({ block: 'center',  behavior: 'smooth' });
        }, 0.3 * 1000);
        //_classesEle[i].scrollIntoView({ block: 'center',  behavior: 'smooth' });
    }
    console.log(connection.view.state.plugin$.decos.find())
    // let current = this.decos.find()
    let current = connection.view.state.plugin$.decos.find()
    console.log('모든 comment?? ' + current.length)
    for (let i = 0; i < current.length; i++){
        let id = current[i].spec.comment.id
        let from = current[i].from
        let to = current[i].to
        if(Number(id_suffix)===id){
            setSelectByOffsetFrom(to, _top_pos);
            break;
        }
        // console.log(">>>>>>>>>>>>>>>>>>>>>" + current[i].spec.comment.id)
        // console.log(current[i].spec.comment)
        // console.log(current[i].spec)
        // console.log(current[i])
    }
    // setSelectByOffsetFrom(_offset_from, _top_pos);
}

/** 코멘트관련 */


export function handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY, _comment_target_id){
    handle_comment_draw(PM_BT_G_COMMENTS_ARRAY, _comment_target_id)
}

export function handle_comment_draw(_comments, _comment_target_id){
    _comment_target_id = _comment_target_id || '_comment_list_wrapper';
    var indx = 0;
    var _htmlText = '';
    for(indx in _comments){
      var id = _comments[indx].id;
      var from = _comments[indx].from;
      var to = _comments[indx].to;
      var text = _comments[indx].text;
      // console.log(from + " -> " + to + " : " + text);

      _htmlText += '<div class="_comments_bt" data-pmbt-offset-from="'+from+'" id="_comments_bt_id_'+id+'" style="background-color: white; border-radius: 5px; margin: 2px 5px 5px 5px; padding: 15px 10px 15px 10px; border: 1px solid black; border-left: 6px solid darkred;">';
      _htmlText += 'comment id : ' + id + "<br>";
      _htmlText += 'index from : ' + from + " ~ ";
      _htmlText += 'index to : ' + to;
      _htmlText += '<br> comment : <span style="font-weight: bold;">' + text + '</span>';
      _htmlText += '</div>';
    }
    document.querySelector("#"+_comment_target_id).innerHTML = _htmlText;

    let _comments_bts = document.querySelectorAll("._comments_bt");
    for(var i=0; i<_comments_bts.length; i++){

      let _tmp_id = _comments_bts[i].id.split('_comments_bt_id_')[1];
      let _offset_from = _comments_bts[i].getAttribute('data-pmbt-offset-from');
      _comments_bts[i].addEventListener("click", function(){
        onCommentBtClicked(_tmp_id, _offset_from);
      }, false)
    }

}


/** 커서를 원하는 위치로 옮김 */
function setSelectByOffsetFrom(offset_from, top_pos){
  connection.view.dispatch(
      connection.view.state.tr.setSelection(
          // TextSelection.near( connection.view.state.doc.resolve(offset_from) )
          TextSelection.create( connection.view.state.tr.doc, Number(offset_from) )
      )
  )
  connection.view.focus()
  // window.scrollTo(0, top_pos);
}

document.onmousedown = function(e) {
    //alert();
    //e.preventDefault()
    // /alert(11);
    // addAnnotation(connection.view.state, connection.dispatch)
}


export function onCommentAddClicked(){
    let _cur_selection = connection.view.state.selection
    if (_cur_selection.empty) {
        alert('문서의 특정 부분을 선택(드래그/블럭지정) 하십시오.');
        return;
    }

    // document.getElementsByClassName('btpm_add_comment_menu')[0].click();
    addAnnotation(connection.view.state, connection.view.dispatch)
}