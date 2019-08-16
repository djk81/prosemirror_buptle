import {Mapping} from "prosemirror-transform"
import {exampleSetup, buildMenuItems} from "prosemirror-example-setup"
import {addListNodes} from "prosemirror-schema-list"
import {TextSelection, Plugin, EditorState} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {MenuItem} from "prosemirror-menu"
import crel from "crel"
import {Schema, DOMParser} from "prosemirror-model";


// import {schema} from "prosemirror-schema-basic"
import {schema} from "./schema-basic-btpm.js"

let _editorSpec = null;
// import {commentPlugin, commentUI, addAnnotation, annotationIcon} from "./comment_1.0"
/*****************************************************
 * Comment Plugin
 * 일정문제로 정식 plugin 제작은 추후에하자
 * index.js 에 모아두고. 외부에서 일부 펑션을 약식으로 오버라이드하는 방식으로 진행함
*****************************************************/
    export let annotationIcon = {
        width: 1024, height: 1024,
        path: "M512 219q-116 0-218 39t-161 107-59 145q0 64 40 122t115 100l49 28-15 54q-13 52-40 98 86-36 157-97l24-21 32 3q39 4 74 4 116 0 218-39t161-107 59-145-59-145-161-107-218-39zM1024 512q0 99-68 183t-186 133-257 48q-40 0-82-4-113 100-262 138-28 8-65 12h-2q-8 0-15-6t-9-15v-0q-1-2-0-6t1-5 2-5l3-5t4-4 4-5q4-4 17-19t19-21 17-22 18-29 15-33 14-43q-89-50-141-125t-51-160q0-99 68-183t186-133 257-48 257 48 186 133 68 183z"
    };

    // 브라우저 내장 Comment 랑 헷갈리지 않게 하자.
    class Comment {
      constructor(text, id, extra) {
        this.text = text
        this.id = id
        this.extra = extra
      }
    }

    class CommentState {
        constructor(version, decos, unsent) {
            this.version = version
            this.decos = decos
            //collab 미사용으로인하여 unsent 는 사용하지 않을지도 모른다.
            this.unsent = unsent
        }

        findComment(id) {
            let current = this.decos.find()
            for (let i = 0; i < current.length; i++)
                if (current[i].spec.comment.id == id) return current[i]
        }

        commentsAt(pos) {
            return this.decos.find(pos, pos)
        }

        apply(tr) {
            let action = tr.getMeta(commentPlugin), actionType = action && action.type;
            window.console.log('코멘트 action 타입 : ' + actionType);

            if (!action && !tr.docChanged) {
                window.console.log('코멘트 변경이 아님 그대로 return this : ' + actionType);
                return this
            }
            let base = this
            if (actionType == "receive") {
                base = base.receive(action, tr.doc)
            }

            let decos = base.decos, unsent = base.unsent;
            decos = decos.map(tr.mapping, tr.doc);

            if (actionType == "newComment") {
                decos = decos.add(tr.doc, [deco(action.from, action.to, action.comment)])
                unsent = unsent.concat(action)
            } else if (actionType == "deleteComment") {
                decos = decos.remove([this.findComment(action.comment.id)])
                unsent = unsent.concat(action)
            }
            return new CommentState(base.version, decos, unsent)
        }

        receive({version, events, sent}, doc) {
            alert('collab 을 사용하지 않을때. receive 들어오는 경우가 있는지?? 이부분은 collab 이 발동되지 않으면 호출되면 안됨.');
            let set = this.decos
            for (let i = 0; i < events.length; i++) {
                let event = events[i]
                if (event.type == "delete") {
                    let found = this.findComment(event.id)
                    if (found) set = set.remove([found])
                } else { // "create"
                    if (!this.findComment(event.id))
                    set = set.add(doc, [deco(event.from, event.to, new Comment(event.text, event.id, event.extra))])
                }
            }
            return new CommentState(version, set, this.unsent.slice(sent))
        }

        unsentEvents() {
            alert('collab 을 사용하지 않을때. unsentEvents() 호출됨. 이부분은 collab 이 발동되지 않으면 호출되면 안됨. ');
            let result = []
            for (let i = 0; i < this.unsent.length; i++) {
                let action = this.unsent[i]
                if (action.type == "newComment") {
                    let found = this.findComment(action.comment.id)
                    if (found) result.push({type: "create", id: action.comment.id,
                                            from: found.from, to: found.to,
                                            text: action.comment.text})
                } else {
                    result.push({type: "delete", id: action.comment.id})
                }
            }
            return result
        }

        static init(config) {
            if(config.comments){
            }else{
                config.comments = {comments:[]}
            }
            if(config.comments.comments){
            }else{
                config.comments.comments = [];
            }
            let decos = config.comments.comments.map(c => deco(c.from, c.to, new Comment(c.text, c.id, c.extra)))
            return new CommentState(config.comments.version, DecorationSet.create(config.doc, decos), [])
        }
    }

    function deco(from, to, comment) {
        return Decoration.inline(from, to, {class: "comment memo _comment_btpm_"+comment.id}, {comment})
    }

    export
    let commentPlugin = new Plugin({
        state: {
            init: CommentState.init,
            apply(tr, prev) { return prev.apply(tr) }
        },
        props: {
            decorations(state) { return this.getState(state).decos }
        }
    });

    let addAnnotation = function(state, dispatch) {
        return btpmAddAnnotationHandler(state, dispatch);
    }

    export const commentUI = function(dispatch) {
        return new Plugin({
            props: {
                decorations(state) {
                    return btpmCommentTooltipHandler(state, dispatch)
                }
            }
        })
    }



    function randomID() {
        return Math.floor(Math.random() * 0xffffffff)
    }

/*****************************************************
 * Comment Plugin END
*****************************************************/


/*****************************************************
 * Track changes START
*****************************************************/
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




    function doCommit(message) {
        console.log('message ==> ' + message);
        let _tr = _editorView.state.tr.setMeta(trackPlugin, message)
        btpmMyHistoryDispatch(_tr)
    }

    function btpmMyHistoryDispatch(tr){
        console.log('=============== btpmMyHistoryDispatch ===================')
        console.log(tr)
        let _new_state = btpmMyDispatch({type: "transaction", transaction:tr})
        
    }

    function setDisabled(state) {
        try{
            let input = document.querySelector("#message")
            let button = document.querySelector("#commitbutton")
            let result = trackPlugin.getState(state).uncommittedSteps.length == 0
            console.log('disabled result => ' + result);
            input.disabled = button.disabled = result
        }catch(e){
            console.log('setDisabled 실패');
            console.log(e);
        }
    }

    let lastRendered = null

export
    function renderCommits(state, dispatch) {
        let curState = trackPlugin.getState(state)
        if (lastRendered == curState) {
            console.log(lastRendered);
            console.log(curState);
            console.log('커밋 렌더 - 리턴됨..!!');
            return
        }
        lastRendered = curState

        let out = document.querySelector("#commits")
        if(!out){
            //이런건 나중에 정리..
            window.console.log('#commits 없음.. ');
            return false
        }
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
                elt("button", {class: "commit-revert"}, "revert")
            )

            try{
                node.lastChild.addEventListener("click", () => revertCommit(commit))
                node.addEventListener("mouseover", e => {
                    if (!node.contains(e.relatedTarget)){
                        dispatch(_editorView.state.tr.setMeta(highlightPlugin, {add: commit}))
                        // var _tr = _editorView.state.tr.setMeta(highlightPlugin, {add: commit})
                        // btpmMyHistoryDispatch(_tr)
                    }
                })
                node.addEventListener("mouseout", e => {
                    if (!node.contains(e.relatedTarget))
                        dispatch(_editorView.state.tr.setMeta(highlightPlugin, {clear: commit}))
                        // var _tr = _editorView.state.tr.setMeta(highlightPlugin, {clear: commit})
                        // btpmMyHistoryDispatch(_tr)
                })
            }catch(e){
                console.log('====== 이벤트 attach 실패 ===========');
                console.log(e);
            }

            out.appendChild(node)
        })
    }

    function elt(name, attrs, ...children) {
        let dom = document.createElement(name)
        if (attrs) for (let attr in attrs) dom.setAttribute(attr, attrs[attr])
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            dom.appendChild(typeof child == "string" ? document.createTextNode(child) : child)
        }
        return dom
    }

    function revertCommit(commit) {
        let _state = _editorView.state
        let trackState = trackPlugin.getState(_state)
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
        let tr = _state.tr
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
        if (tr.docChanged) {
            var _tr = tr.setMeta(trackPlugin, `Revert '${commit.message}'`)

            btpmMyHistoryDispatch(_tr)
        }
    }

/*****************************************************
 * Track changes END
*****************************************************/


export class EditorSpec {
    constructor(div_target_id, div_comments_target_id, get_document_html_handler, functions) {
        this.div_target_id = div_target_id
        this.is_memo_activate = false
        this.is_track_changes_activate = false
        this.div_comments_target_id = div_comments_target_id
        this.get_document_html_handler = get_document_html_handler
        this.functions = functions
    }
}


/** index.js 외부에서 호출할때 CORE 초기화 START    */
export var ptpm_comment_list_target_element_id = null;
var _editorView = null;

export function editorInitBySpec(editorSpec, init_function){
    _editorSpec = editorSpec;
    var document_html = editorSpec.get_document_html_handler();
    var comments = null;
    if(editorSpec.is_memo_activate){
        comments = editorSpec.functions.get_comments();
        // alert('코멘트 초기화 외부에서 가져옴 : ' + comments.comments.length);
        ptpm_comment_list_target_element_id = editorSpec.div_comments_target_id;

        if(editorSpec.functions.btpmHandleCommentDraw){
            btpmHandleCommentDraw = editorSpec.functions.btpmHandleCommentDraw.bind(this);
        }

        if(editorSpec.functions.btpmRenderCommentHandler){
            btpmRenderCommentHandler = editorSpec.functions.btpmRenderCommentHandler.bind(this);
        }

        if(editorSpec.functions.btpmRenderCommentsHandler){
            btpmRenderCommentsHandler = editorSpec.functions.btpmRenderCommentsHandler.bind(this);
        }


    }

    return __btpmInitView(editorSpec.div_target_id, document_html, comments);
}

export function editorInit(div_target_id, content_id, _comment_target_id){
    //connection = window.connection = new EditorConnection(report, "/docs/Example", target_id) // + isID[1]  <-- 이거 지네 데모에만 필요한거
    ptpm_comment_list_target_element_id = _comment_target_id;
    return __btpmInitView(div_target_id, _tmp_doc, _tmp_comments);
}

    function __btpmInitView(target_id, document_html, comments){
        let _editorState = btpmGetState(document_html, comments);
        _editorView = new EditorView(document.querySelector("#" + target_id), {
              state: _editorState,
              dispatchTransaction(transaction) {
                  btpmMyDispatch({type: "transaction", transaction})
              }
        });

        //최초 init 콜 패치
        if(_editorSpec.is_memo_activate){
            var comments = btpmGetAllComments()
            // alert('코멘트 초기화 내부. plugin에서 가져옴 : ' + comments.length);
            btpmHandleCommentDraw(comments, null);
        }

        return _editorView;
    }

    function btpmMyDispatch(action, no_note_update){

        window.console.log('================ action in transaction ===============');
        window.console.log(action);
        // console.log("Document size went from", action.transaction.before.content.size, "to", action.transaction.doc.content.size)
        // alert(action.type, action.transaction);
        let _new_state = _editorView.state.apply(action.transaction);
        _editorView.updateState(_new_state);

        if(no_note_update && true===no_note_update){
        }else{
            btpmDispatchPostProcessor(_editorView, _new_state,  action);
        }
        

        return _new_state
    }


    /*****************************************************
     * Schema 확장
    *****************************************************/

    const buptleSpanSpec = {
        attrs : {id:{default:'tmp_span_id'}, class:{default:'btpm_default_class'}},
        // content: "text*",
        // marks: "",
        // group: "block",
        // defining: true,
        content: "(inline | text* | buptle_extra* )",
        inline: true,
        group: "inline",
        atom:true,
        toDOM(node){
            return ['span',
                {
                    id:node.attrs.id,
                    class:node.attrs.class
                },
                0]
        },
        parseDOM: [{
            tag: "span",
            getAttrs(dom){
                // console.log(dom);
                 return { id: dom.id, class:dom.className }
            }
        }]
    };

    const buptleLabelSpec = {
        attrs : {for:{default:''}, class:{default:'btpm_label_class'}},
        // content: "text*",
        // marks: "",
        // group: "block",
        // defining: true,
        content: "(inline | text*)",
        inline: true,
        group: "buptle_extra",
        atom:false,
        toDOM(node){
            return ['label', {for:node.attrs.for, class:node.attrs.class},0]
        },
        parseDOM: [{
            tag: "label",
            getAttrs(dom){
                // console.log(dom);
                // alert('getAttrs :' + dom.className );
                return { class:dom.className, for:dom.getAttribute('for') }
            }
        }]
    };

    const buptleInputsSpec = {
        attrs : {
            id : {default:''},
            width:{default:''},
            height:{default:''},
            style:{default:''},
            type:{default:'text'},
            class:{default:'btpm_inputs_class'}
            },
        content: "(inline | text*)",
        inline: true,
        group: "buptle_extra",
        atom:false,
        toDOM(node){
            let {id, src, alt, title, align, width, height, style, float} = node.attrs;
            let type = node.attrs.type
            return ["input",
                {width, height, style, type, class : node.attrs.class, id:node.attrs.id}, 0
                ]
        },
        parseDOM: [{
            tag: "input",
            getAttrs(dom){
                // console.log(dom);
                // alert('getAttrs :' + dom.className );
                return {
                    width: dom.getAttribute("width"),
                    height: dom.getAttribute("height"),
                    style: dom.getAttribute("style"),
                    type: dom.getAttribute("type"),
                    class: dom.getAttribute("class"),
                    id: dom.getAttribute("id"),
                }
            }
        }]
    };

    const buptleParagraphSpec = {
        attrs : {align:{default:'left'}, style:{default:''}},
        content: "inline*",
        group: "block",
          toDOM(node){
                return ['p',
                    {
                        align:node.attrs.align,
                        style:node.attrs.style
                    },
                    0]
            },
            parseDOM: [{
                tag: "p",
                getAttrs(dom){
                    // console.log(dom);
                     return { align:dom.align, style:dom.getAttribute('style') }
                }
            }]
    };

    const buptleImgSpec = {
        inline: true,
        attrs: {
          src: {},
          alt: {default: null},
          title: {default: null},
          align : {default : 'left'},
          width : {default : '100%'},
          height : {default : '100%'},
          style : {default : ''},
        },
        group: "inline",
        draggable: true,
        parseDOM: [{tag: "img[src]", getAttrs(dom) {
          return {
            src: dom.getAttribute("src"),
            title: dom.getAttribute("title"),
            alt: dom.getAttribute("alt"),
            align: dom.getAttribute("align"),
            width: dom.getAttribute("width"),
            height: dom.getAttribute("height"),
            style: dom.getAttribute("style"),
            float: dom.getAttribute("float"),
          }
        }}],
        toDOM(node) {
            let {src, alt, title, align, width, height, style, float} = node.attrs;
            return ["img",
                {src, alt, title, align, width, height, style, float}
                ]
        }
    }

    const buptleHeadingSpec = {
        attrs: {level: {default: 1}, align: {default:'left'}},
        content: "inline*",
        group: "block",
        defining: true,
        parseDOM: [
            {
                tag: "h1",
                getAttrs(dom) {
                    return {
                        level: 1,
                        align: dom.getAttribute('align')
                    }
                }
            },
            {
                tag: "h2",
                getAttrs(dom) {
                    return {
                        level: 2,
                        align: dom.getAttribute('align')
                    }
                }
            },
            {
                tag: "h3",
                getAttrs(dom) {
                    return {
                        level: 3,
                        align: dom.getAttribute('align')
                    }
                }
            },
            {
                tag: "h4",
                getAttrs(dom) {
                    return {
                        level: 4,
                        align: dom.getAttribute('align')
                    }
                }
            },
            {
                tag: "h5",
                getAttrs(dom) {
                    return {
                        level: 5,
                        align: dom.getAttribute('align')
                    }
                }
            },
            {
                tag: "h6",
                getAttrs(dom) {
                    return {
                        level: 6,
                        align: dom.getAttribute('align')
                    }
                }
            }

                   ],
        toDOM(node) { return ["h" + node.attrs.level, {align : node.attrs.align}, 0] }
    }


    const nodeSpec = schema.spec.nodes.remove('heading').addBefore('code_block', 'heading',buptleHeadingSpec)
        .remove('image').addBefore('hard_break', 'image',buptleImgSpec)
        .addBefore("image", "span", buptleSpanSpec)
        .addBefore("span", "label", buptleLabelSpec)
        .addBefore("span", "buptleInputsSpec", buptleInputsSpec)
        .remove('paragraph').addBefore('blockquote', 'paragraph',buptleParagraphSpec)


    const buptleSchema = new Schema({
        nodes: nodeSpec,
        marks: schema.spec.marks
    })

    function btpmGetState(_doc, comments){
        let pluginsArray = exampleSetup({schema, history: false, menuContent: menu.fullMenu}).concat([history({preserveItems: true})]);

        if(_editorSpec.is_memo_activate){
            pluginsArray = pluginsArray.concat([commentPlugin, commentUI( transaction => btpmMyDispatch({type: "transaction", transaction}) )]);
            menu.fullMenu[0].push(_annotationMenuItem)
        }

        if(_editorSpec.is_track_changes_activate){
            pluginsArray = pluginsArray.concat([trackPlugin, highlightPlugin]);
            try{
                document.querySelector("#commitbutton").addEventListener("click", e => {
                    e.preventDefault()
                    var message = document.querySelector("#message").value;
                    console.log(message);
                    doCommit(message || "Unnamed")
                    document.querySelector("#message").value = ""
                    _editorView.focus()
                })
            }catch(e){
                console.log(e);
            }
        }

        let editState = EditorState.create({
            doc: DOMParser.fromSchema(buptleSchema).parse(_doc),
            plugins: pluginsArray,
            comments: comments
        });

        return editState;
    }
/** index.js 외부에서 호출할때 CORE 초기화 END  */

    /** 테스트 데이터 */
    var _tmp_doc = crel('div',
        crel('h1', '해지계약서'),
        crel('p', 'This is temporary. This is temporary. This is temporary.')
    );

    // crel('input', { type: 'number' }

    /** 테스트 데이터 */
    var _tmp_comments = {
        comments : [
            {
            from : 0,
            to : 2,
            text: '_default comment',
            id : '1234'
            }
        ]
    }

    const _annotationMenuItem = new MenuItem({
      title: "코멘트입력",
      run: addAnnotation,
      select: state => addAnnotation(state),
      icon: annotationIcon,
      class : "btpm_add_comment_menu"
    })

    const trackPlugin = new Plugin({
        state: {
            init(_, instance) {
                return new TrackState([new Span(0, instance.doc.content.size, null)], [], [], [])
            },
            apply(tr, tracked) {
                if (tr.docChanged) tracked = tracked.applyTransform(tr)
                let commitMessage = tr.getMeta(this)
                console.log('커밋메세지 : ' + commitMessage);
                if (commitMessage) tracked = tracked.applyCommit(commitMessage, new Date(tr.time))
                return tracked
            }
        }
    });

    const highlightPlugin = new Plugin({
        state: {
            init() {
                return {deco: DecorationSet.empty, commit: null}
            },
            apply(tr, prev, oldState, state) {
                console.log('의도치 않은 highlightPlugin apply 가 호출됨.');
                let highlight = tr.getMeta(this)
                if (highlight && highlight.add != null && prev.commit != highlight.add) {
                    console.log('blame marker!');
                    let tState = trackPlugin.getState(oldState)
                    let decos = tState.blameMap
                        .filter(span => tState.commits[span.commit] == highlight.add)
                        .map(span => Decoration.inline(span.from, span.to, {class: "blame-marker"}))
                    return {deco: DecorationSet.create(state.doc, decos), commit: highlight.add}
                } else if (highlight && highlight.clear != null && prev.commit == highlight.clear) {
                    console.log('clear!');
                    return {deco: DecorationSet.empty, commit: null}
                } else if (tr.docChanged && prev.commit) {
                    console.log('else if ');
                    return {deco: prev.deco.map(tr.mapping, tr.doc), commit: prev.commit}
                } else {
                    console.log('else');
                    return prev
                }
            }
        },
        props: {
            decorations(state) {
                return this.getState(state).deco
            }
        }
    });

    let menu = buildMenuItems(buptleSchema)


   function btpmGetAllComments(){
       var _decos = _editorView.state.plugin$.decos.find()
       return _decos;
   }








/****
 * 외부에서 export 혹은 내부에서 재정의하여 사용하자. 플러그인 방식 제작은 추후에 다시 리팩토링..
 ***/

export
    function btpmDispatchPostProcessor(_editorView, _new_state, action){

        if(_editorSpec.is_memo_activate){
            var comments = btpmGetAllComments()
            // console.log(comments.length + " < 메모active 되었고. 길이는 다음과 같음.");
            btpmHandleCommentDraw(comments, action);
        }

        if(_editorSpec.is_track_changes_activate){
            /**  Track Changes 적용*/
            setDisabled(_new_state)
            renderCommits(_new_state, btpmMyHistoryDispatch)
        }

    }

export
    function btpmHandleCommentDraw(_comments, action){

        var indx = 0;
        var _htmlText = '';
        // alert('코멘트갯수 안에서 : ' + _comments.length + " : " + ptpm_comment_list_target_element_id);

        for(indx in _comments){
            var id = _comments[indx].spec.comment.id;
            var from = _comments[indx].from;
            var to = _comments[indx].to;
            var text = _comments[indx].spec.comment.text;
            console.log(_comments[indx]);
            console.log(from + " -> " + to + " : " + text);

            _htmlText += '<div class="_comments_bt" id="_comments_bt_id_'+id+'" style="background-color: white; border-radius: 5px; margin: 2px 5px 5px 5px; padding: 15px 10px 15px 10px; border: 1px solid black; border-left: 6px solid darkred;">';
            _htmlText += 'comment id : ' + id + "<br>";
            _htmlText += 'index from : ' + from + " ~ ";
            _htmlText += 'index to : ' + to;
            _htmlText += '<br> comment : <span style="font-weight: bold;">' + text + '</span>';
            _htmlText += '</div>';
        }

        window.console.log(document.querySelector("#"+ptpm_comment_list_target_element_id) + " << ptpm_comment_list_target_element_id : " + ptpm_comment_list_target_element_id);
        document.querySelector("#"+ptpm_comment_list_target_element_id).innerHTML = _htmlText;

        let _comments_bts = document.querySelectorAll("._comments_bt");
        for(var i=0; i<_comments_bts.length; i++){
            let _tmp_id = _comments_bts[i].id.split('_comments_bt_id_')[1];
            try{
                _comments_bts[i].addEventListener("click", function(){
                    btpmOnCommentBtClicked(_tmp_id);
                }, false)
            }catch(e){
                console.log(e);
            }
        }
    }

export
    function btpmOnCommentBtClicked(id_suffix){
        //에디터 안에서 바꿔봄
        let _classesEle = document.getElementsByClassName('_comment_btpm_' + id_suffix);
        let _top_pos = 0;
        for(var i=0; i<_classesEle.length; _classesEle++){
            _top_pos = _classesEle[i].offsetTop;
            var _target = _classesEle[i]
            setTimeout( function() {
                _target.scrollIntoView({ block: 'center',  behavior: 'smooth' });
            }, 0.3 * 1000);
        }

        let current = _editorView.state.plugin$.decos.find()

        for (let i = 0; i < current.length; i++){
            let id = current[i].spec.comment.id
            let from = current[i].from
            let to = current[i].to
            if(Number(id_suffix)===id){
                btpmSetSelectByOffsetFrom(to, _top_pos);
                break;
            }
        }
        // setSelectByOffsetFrom(_offset_from, _top_pos);
    }

    /** 커서를 원하는 위치로 옮김 */
    function btpmSetSelectByOffsetFrom(offset_from, top_pos){
      _editorView.dispatch(
          _editorView.state.tr.setSelection(
              // TextSelection.near( connection.view.state.doc.resolve(offset_from) )
              TextSelection.create( _editorView.state.tr.doc, Number(offset_from) )
          )
      )
      _editorView.focus();
    }

export
    function btpmAddAnnotationHandler( state, dispatch ){
        if(_editorSpec.functions.addAnnotation){
            return _editorSpec.functions.addAnnotation(commentPlugin, state, dispatch, Comment, randomID );
        }

        let sel = state.selection
        if (sel.empty) {
            return false
        }
        if (dispatch) {
            let text = prompt("입력하시오", "")

            var extra = {
                  name:'extra_name',
                  info_1:'extra_info_1',
                  info_2:'extra_info_2',
                  };

            if (text)
              dispatch(state.tr.setMeta(commentPlugin, {type: "newComment", from: sel.from, to: sel.to, comment: new Comment(  text, randomID(), extra  )}))
        }
        return true
    }

export
    function btpmCommentTooltipHandler(state, dispatch) {
        // releaseFoucusToAllSelectedComment(); TODO
        let sel = state.selection
        if (!sel.empty) {
            return null
        }
        let comments = commentPlugin.getState(state).commentsAt(sel.from)
        if (!comments.length) {
            return null
        }
        return DecorationSet.create(state.doc, [Decoration.widget(sel.from, btpmRenderCommentsHandler(comments, dispatch, state))])
    }

export
    function btpmRenderCommentsHandler(comments, dispatch, state) {
        console.log('render ss!! :' + comments.length);
        return crel("div", {class: "tooltip-wrapper"},
                  crel("ul", {class: "commentList"},
                       comments.map(c => btpmRenderCommentHandler(c.spec.comment, dispatch, state))))
    }

export
    function btpmRenderCommentHandler(comment, dispatch, state) {
        console.log('render comment original !! -> ' + comment.text);
        let btn = crel("button", {class: "commentDelete", title: "삭제하기"}, "삭제")

        try {
            btn.addEventListener("click", () =>
                dispatch(state.tr.setMeta(commentPlugin, {type: "deleteComment", comment}))
            )
        }catch(e){
            console.log(e);
        }

        // 선택된 코멘트 강조
        // btpmMakeFocusToSelectedComment(comment.id);
        var rtn = crel("li", {class: "commentText"}, comment.text, btn);
        console.log(rtn)
        return rtn
    }

    // 코멘트 강조
    function btpmMakeFocusToSelectedComment(_comment_id){
        var _element = document.getElementById('_comments_bt_id_' + _comment_id);
        if(_element){

            _element.style.backgroundColor = 'lightblue;';
            document.getElementById('_comments_bt_id_' + _comment_id).style.backgroundColor = 'lightblue;';

            // alert(" << " + document.getElementById('_comments_bt_id_' + _comment_id).style.backgroundColor);
            _element.scrollIntoView({ block: 'center',  behavior: 'smooth' });

            // _element.style.color = 'white';

            console.log('코멘트 강조 킴 -> _comments_bt_id_' + _comment_id);
            console.log('코멘트 강조 킴 -> html 확인 : ' + _element.outerHTML);

            //에디터 안에서 바꿔봄
            let _classesEle = document.getElementsByClassName('_comment_btpm_' + _comment_id);
            let _selected_btpm_text = '';
            for(var i=0; i<_classesEle.length; _classesEle++){
                if(i==0){
                     _classesEle[i].style.borderLeft = '10px solid red';
                     // _classesEle[i].style.border = '5px dotted red';
                     // _classesEle[i].style.padding = '3px 5px 3px 5px';
                     // _classesEle[i].innerHTML = '☞' + _classesEle[i].innerHTML;
                }else{}
                _selected_btpm_text += _classesEle[i].outerText;
            }
        }else{
         console.log('코멘트 div 없음 : ' + _comment_id)
        }
    }