import crel from "crel"
import {Plugin} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"

// export let PM_BT_G_COMMENTS_ARRAY = Array()

// 속성추가 고려
class Comment {
  constructor(text, id) {
    this.id = id
    this.text = text
  }
}


function deco(from, to, comment) {
    // console.log('데코레이터로 변환 ->>>>> ' + comment.id);
    return Decoration.inline(from, to, {class: "comment _comment_btpm_"+comment.id}, {comment})
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
        let action = tr.getMeta(commentPlugin), actionType = action && action.type

        window.console.log('코멘트 action 타입 : ' + actionType);

        if (!action && !tr.docChanged) {
            window.console.log('코멘트 변경이 아님 그대로 return this : ' + actionType);
            return this
        }
        let base = this
        if (actionType == "receive") {
            base = base.receive(action, tr.doc)
        }
        let decos = base.decos, unsent = base.unsent
        decos = decos.map(tr.mapping, tr.doc)
        if (actionType == "newComment") {
            decos = decos.add(tr.doc, [deco(action.from, action.to, action.comment)])
            unsent = unsent.concat(action)


            //collab 을 끄고 여기서 직접 핸들링
            // PM_BT_G_COMMENTS_ARRAY.push({
            //     type:'create', id : action.comment.id, from:action.from, to:action.to,
            //     text:action.comment.text
            // });
            alert('add 핸들링 완료!');

        } else if (actionType == "deleteComment") {
          decos = decos.remove([this.findComment(action.comment.id)])
          unsent = unsent.concat(action)
        }
        return new CommentState(base.version, decos, unsent)
  }

  receive({version, events, sent}, doc) {
      alert('receive 들어오는 경우가 있는지?? 이부분은 collab 이 발동되지 않으면 호출되면 안됨.');
    let set = this.decos
    for (let i = 0; i < events.length; i++) {
      let event = events[i]
      if (event.type == "delete") {
        let found = this.findComment(event.id)
        if (found) set = set.remove([found])
          // let i=0;
          // for(;i<PM_BT_G_COMMENTS_ARRAY.length; i++){
          //     if(PM_BT_G_COMMENTS_ARRAY[i].id==event.id){
          //         break;
          //     }
          // }
          // PM_BT_G_COMMENTS_ARRAY.splice(i, 1);
      } else { // "create"
        if (!this.findComment(event.id))
          set = set.add(doc, [deco(event.from, event.to, new Comment(event.text, event.id))])
          // PM_BT_G_COMMENTS_ARRAY.push(event);
      }
    }
    return new CommentState(version, set, this.unsent.slice(sent))
  }

  unsentEvents() {
      alert('unsentEvents() 호출됨. 이부분은 collab 이 발동되지 않으면 호출되면 안됨. ');
    let result = []
    for (let i = 0; i < this.unsent.length; i++) {
      let action = this.unsent[i]
      if (action.type == "newComment") {
        let found = this.findComment(action.comment.id)
        if (found) result.push({type: "create", id: action.comment.id,
                                from: found.from, to: found.to,
                                text: action.comment.text})
          // PM_BT_G_COMMENTS_ARRAY.push(result[result.length-1]);
      } else {
        result.push({type: "delete", id: action.comment.id})
        // let i=0;
        // for(;i<PM_BT_G_COMMENTS_ARRAY.length; i++){
        //     console.log("=================== 비교")
        //     console.log(PM_BT_G_COMMENTS_ARRAY[i])
        //     console.log(action.comment)
        //   if(PM_BT_G_COMMENTS_ARRAY[i].id==action.comment.id){
        //       break;
        //   }
        // }
        // PM_BT_G_COMMENTS_ARRAY.splice(i, 1);
      }
    }
    return result
  }

  static init(config) {
      let decos = config.comments.comments.map(c => deco(c.from, c.to, new Comment(c.text, c.id)))
      // PM_BT_G_COMMENTS_ARRAY = PM_BT_G_COMMENTS_ARRAY.concat(config.comments.comments)
        // alert('푸쉬완료 : ' + PM_BT_G_COMMENTS_ARRAY.length);
      return new CommentState(config.comments.version, DecorationSet.create(config.doc, decos), [])
  }
}

export const commentPlugin = new Plugin({
  state: {
    init: CommentState.init,
    apply(tr, prev) { return prev.apply(tr) }
  },
  props: {
    decorations(state) { return this.getState(state).decos }
  }
})

function randomID() {
  return Math.floor(Math.random() * 0xffffffff)
}

// Command for adding an annotation
export const addAnnotation = function(state, dispatch) {
    console.log('addAnnotation >> state');
    console.log(state);
    console.log('addAnnotation >> dispatch');
    console.log(dispatch);

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

export const annotationIcon = {
  width: 1024, height: 1024,
  path: "M512 219q-116 0-218 39t-161 107-59 145q0 64 40 122t115 100l49 28-15 54q-13 52-40 98 86-36 157-97l24-21 32 3q39 4 74 4 116 0 218-39t161-107 59-145-59-145-161-107-218-39zM1024 512q0 99-68 183t-186 133-257 48q-40 0-82-4-113 100-262 138-28 8-65 12h-2q-8 0-15-6t-9-15v-0q-1-2-0-6t1-5 2-5l3-5t4-4 4-5q4-4 17-19t19-21 17-22 18-29 15-33 14-43q-89-50-141-125t-51-160q0-99 68-183t186-133 257-48 257 48 186 133 68 183z"
}

// Comment UI

export const commentUI = function(dispatch) {
  return new Plugin({
    props: {
      decorations(state) {
        return commentTooltip(state, dispatch)
      }
    }
  })
}

function commentTooltip(state, dispatch) {
// console.log('commentTooltip ! ');
    releaseFoucusToAllSelectedComment();
    let sel = state.selection
    if (!sel.empty) {
        return null
    }
    let comments = commentPlugin.getState(state).commentsAt(sel.from)
    if (!comments.length) {
        // console.log('commentTooltip 2222 ');
        return null
    }
    return DecorationSet.create(state.doc, [Decoration.widget(sel.from, renderComments(comments, dispatch, state))])
}

function renderComments(comments, dispatch, state) {
    console.log('render ss!! :' + comments.length);
    return crel("div", {class: "tooltip-wrapper"},
              crel("ul", {class: "commentList"},
                   comments.map(c => renderComment(c.spec.comment, dispatch, state))))
}

function renderComment(comment, dispatch, state) {
    console.log('render comment!! -> ' + comment.id);
    let btn = crel("button", {class: "commentDelete", title: "삭제하기"}, "삭제")
    btn.addEventListener("click", () =>
    dispatch(state.tr.setMeta(commentPlugin, {type: "deleteComment", comment}))
)

  // 선택된 코멘트 강조
  makeFocusToSelectedComment(comment.id);
  return crel("li", {class: "commentText"}, comment.text, btn)
}


 /**커스텀START*/
 // 코멘트 강조
 function makeFocusToSelectedComment(_comment_id){
     var _element = document.getElementById('_comments_bt_id_' + _comment_id);
     if(_element){
         _element.style.backgroundColor = 'lightblue;';
         document.getElementById('_comments_bt_id_' + _comment_id).style.backgroundColor = 'lightblue;';
         alert(" << " + document.getElementById('_comments_bt_id_' + _comment_id).style.backgroundColor);
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
             }else{
             }
             _selected_btpm_text += _classesEle[i].outerText;
         }
     }else{
         console.log('코멘트 div 없음 : ' + _comment_id)
     }
 }

 // 모든 코멘트 강조 해제
function releaseFoucusToAllSelectedComment(){

    var _elements = document.getElementsByClassName('_comments_bt');
    for (var i = 0; i < _elements.length; i++) {
      _elements[i].style.backgroundColor = 'white';
      // console.log('코멘트 하얗게 끔');
    }

    _elements = document.getElementsByClassName('comment');
    for (var i = 0; i < _elements.length; i++) {
      _elements[i].style.border = 'None';
    }
}
 /**커스텀END*/