import {exampleSetup, buildMenuItems} from "prosemirror-example-setup"
import {schema} from "prosemirror-schema-basic"
import {TextSelection, Plugin, EditorState} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {MenuItem} from "prosemirror-menu"
import crel from "crel"
import {DOMParser} from "prosemirror-model";

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
      constructor(text, id) {
        this.id = id
        this.text = text
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
                    set = set.add(doc, [deco(event.from, event.to, new Comment(event.text, event.id))])
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
            let decos = config.comments.comments.map(c => deco(c.from, c.to, new Comment(c.text, c.id)))
            return new CommentState(config.comments.version, DecorationSet.create(config.doc, decos), [])
        }
    }

    function deco(from, to, comment) {
        return Decoration.inline(from, to, {class: "comment _comment_btpm_"+comment.id}, {comment})
    }

    const commentPlugin = new Plugin({
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

export class EditorSpec {
    constructor(div_target_id, div_comments_target_id, get_document_html_handler, functions) {
        this.div_target_id = div_target_id
        this.div_comments_target_id = div_comments_target_id
        this.get_document_html_handler = get_document_html_handler
        this.functions = functions
    }
}


/** index.js 외부에서 호출할때 CORE 초기화 START    */
export var ptpm_comment_list_target_element_id = null;
var _editorView = null;
var _editorState = null;

export function editorInitBySpec(editorSpec){
    alert('editorInitBySpec');
    var document_html = editorSpec.get_document_html_handler();
    var comments = editorSpec.functions.get_comments();
    ptpm_comment_list_target_element_id = editorSpec.div_comments_target_id;

    return __btpmInitView(editorSpec.div_target_id, document_html, comments);
}

export function editorInit(div_target_id, content_id, _comment_target_id){
    alert('editorInit');
    //connection = window.connection = new EditorConnection(report, "/docs/Example", target_id) // + isID[1]  <-- 이거 지네 데모에만 필요한거
    ptpm_comment_list_target_element_id = _comment_target_id;
    return __btpmInitView(div_target_id, _tmp_doc, _tmp_comments);
}

    function __btpmInitView(target_id, document_html, comments){
        _editorState = btpmGetState(document_html, comments);
        _editorView = new EditorView(document.querySelector("#" + target_id), {
              state: _editorState,
              dispatchTransaction(transaction) {
                  btpmMyDispatch({type: "transaction", transaction})
              }
        });
        return _editorView;
    }

    function btpmMyDispatch(action){
        window.console.log(action);
        window.console.log(action + " <<<<< btpmMyDispatch ");
        // console.log("Document size went from", action.transaction.before.content.size, "to", action.transaction.doc.content.size)
        // alert(action.type, action.transaction);
        let _new_state = _editorView.state.apply(action.transaction);
        _editorView.updateState(_new_state);

        btpmDispatchPostProcessor(_editorView, action);
    }

    function btpmGetState(_doc, comments){
        let editState = EditorState.create({
            schema,
            doc: DOMParser.fromSchema(schema).parse(_doc),
            plugins: exampleSetup({schema, history: false, menuContent: menu.fullMenu}).concat([
                history({preserveItems: true}),
                commentPlugin,
                commentUI( transaction => btpmMyDispatch({type: "transaction", transaction}) ),
                highlightPlugin
                // trackPlugin,
            ]),
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
                alert(' 변경사항 추적 apply 가 호출됨 trackplugin');
                if (tr.docChanged) tracked = tracked.applyTransform(tr)
                let commitMessage = tr.getMeta(this)
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
                // alert('의도치 않은 highlightPlugin apply 가 호출됨.');
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
    });

    let menu = buildMenuItems(schema)
    menu.fullMenu[0].push(_annotationMenuItem)

   function btpmGetAllComments(){
       var _decos = _editorView.state.plugin$.decos.find()
       return _decos;
   }








/****
 * 외부에서 export 혹은 내부에서 재정의하여 사용하자. 플러그인 방식 제작은 추후에 다시 리팩토링..
 ***/

export
    function btpmDispatchPostProcessor(_editorView, action){
        btpmHandleCommentDraw(btpmGetAllComments(), action);
    }

export
    function btpmHandleCommentDraw(_comments, action){

        var indx = 0;
        var _htmlText = '';
        console.log('코멘트갯수 : ' + _comments.length);

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
            _comments_bts[i].addEventListener("click", function(){
                btpmOnCommentBtClicked(_tmp_id);
            }, false)
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
        let sel = state.selection
        if (sel.empty) {
            return false
        }
        if (dispatch) {
            let text = prompt("입력하시오", "")
            if (text)
              dispatch(state.tr.setMeta(commentPlugin, {type: "newComment", from: sel.from, to: sel.to, comment: new Comment(text, randomID())}))
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
        console.log('render comment!! -> ' + comment.id);
        let btn = crel("button", {class: "commentDelete", title: "삭제하기"}, "삭제")
        btn.addEventListener("click", () =>
            dispatch(state.tr.setMeta(commentPlugin, {type: "deleteComment", comment}))
        )

        // 선택된 코멘트 강조
        btpmMakeFocusToSelectedComment(comment.id);
        return crel("li", {class: "commentText"}, comment.text, btn)
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