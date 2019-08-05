import {exampleSetup, buildMenuItems} from "prosemirror-example-setup"
import {schema} from "prosemirror-schema-basic"
import {TextSelection, Plugin, EditorState} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"
import {history} from "prosemirror-history"
import {MenuItem} from "prosemirror-menu"
import crel from "crel"
import {DOMParser} from "prosemirror-model";

import {PM_BT_G_COMMENTS_ARRAY, commentPlugin, commentUI, addAnnotation, annotationIcon} from "./comment_1.0"

//ie - 빌드 테스트
class TestClass{
    init(){
        alert('TestClass init!!');
    }
}

/** index.js 외부에서 호출할때     */
export function editorInit(target_id, content_id, _comment_target_id){
    alert('editorInit');
    new TestClass().init()
    
    // 문서조회
    //connection = window.connection = new EditorConnection(report, "/docs/Example", target_id) // + isID[1]  <-- 이거 지네 데모에만 필요한거
    btpmInitView(target_id);
}


    var _tmp_doc = crel('div',
        crel('h1', '해지계약서'),
        crel('p', 'This is temporary. This is temporary. This is temporary.')
    );

    // crel('input', { type: 'number' }

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
                alert('나도야간다 trackplugin');
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
                // alert('나도야간다 highlightPlugin');
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


    export function btpm_handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY, _comment_target_id) {
	  btpm_handle_comment_draw(PM_BT_G_COMMENTS_ARRAY, _comment_target_id);
	}

    export function btpm_handle_comment_draw(_comments, _comment_target_id){
        _comment_target_id = _comment_target_id || '_comment_list_wrapper';
        var indx = 0;
        var _htmlText = '';
        console.log('코멘트갯수 : ' + _comments.length);
        for(indx in _comments){
            var id = _comments[indx].id;
            var from = _comments[indx].from;
            var to = _comments[indx].to;
            var text = _comments[indx].text;
            console.log(from + " -> " + to + " : " + text);

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
              //onCommentBtClicked(_tmp_id, _offset_from);
            }, false)
        }
    }

function onCommentBtClicked(id_suffix, _offset_from){
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
    console.log(_editorView.state.plugin$.decos.find())
    let current = _editorView.state.plugin$.decos.find()
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





    var _editorView = null;
    var _editorState = null;
    function btpmInitView(target_id, content_id, _comment_target_id){
        _editorState = btpmGetState(_tmp_doc, _tmp_comments);
        _editorView = new EditorView(document.querySelector("#" + target_id), {
              state: _editorState,
              dispatchTransaction(transaction) {
                  btpmMyDispatch({type: "transaction", transaction, '_comment_target_id' : _comment_target_id})
              }
        });

    }

    function btpmMyDispatch(action){
        window.console.log(action);
        window.console.log(action + " <<<<< btpmMyDispatch ");
        console.log("Document size went from", action.transaction.before.content.size,
                "to", action.transaction.doc.content.size)
        // alert(action.type, action.transaction);
        let _new_state = _editorView.state.apply(action.transaction);
        _editorView.updateState(_new_state);

        btpm_handle_comment_draw_by_btpm_array(PM_BT_G_COMMENTS_ARRAY, action.comment_target_id);
    }

    function btpmGetState(_doc, comments){
        let editState = EditorState.create({
            schema,
            doc: DOMParser.fromSchema(schema).parse(_doc),
            plugins: exampleSetup({schema, history: false, menuContent: menu.fullMenu}).concat([
                history({preserveItems: true}),
                commentPlugin,
                commentUI( transaction => this.dispatch({type: "transaction", transaction}) ),
                highlightPlugin
                // trackPlugin,
            ]),
            comments: comments
        });

        return editState;
    }

    //function