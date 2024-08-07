import {
    Mapping
} from "prosemirror-transform"
import {
    exampleSetup,
} from "prosemirror-example-setup" //buildMenuItems
import {
    liftListItem,
    splitListItem,
    wrapInList,
    addListNodes
} from "prosemirror-schema-list"
import {
    NodeSelection,
    TextSelection,
    Plugin,
    EditorState,
    PluginKey
} from "prosemirror-state"
import {
    Decoration,
    DecorationSet,
    EditorView
} from "prosemirror-view"
import {
    history
} from "prosemirror-history"
import {
    redoItem,
    undoItem,
    selectParentNodeItem,
    liftItem,
    joinUpItem,
    DropdownSubmenu,
    blockTypeItem,
    wrapItem,
    icons,
    MenuItem,
    Dropdown
} from "prosemirror-menu"
import {
    keymap
} from "prosemirror-keymap"
import crel from "crel"
import {
    Schema,
    DOMParser,
    DOMSerializer
} from "prosemirror-model";
import {
    chainCommands,
    toggleMark,
    setBlockType,
    wrapIn,
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitBlockKeepMarks
} from "prosemirror-commands"

/** table 추가 */
import {
    addColumnAfter,
    addColumnBefore,
    deleteColumn,
    addRowAfter,
    addRowBefore,
    deleteRow,
    mergeCells,
    splitCell,
    setCellAttr,
    toggleHeaderRow,
    toggleHeaderColumn,
    toggleHeaderCell,
    goToNextCell,
    deleteTable
} from "./table/commands"
import {
    tableEditing,
    columnResizing,
    tableNodes,
    fixTables
} from "./table"

import {
    schema
} from "./schema-basic-btpm.js"
import _ from 'loadsh';
import e from "cors"

var prefix = "ProseMirror-prompt";

let BTPM_BASE_ICONS_PATH = null;


/** todolist */
const todoItemSpec = {
    attrs: {
        done: {
            default: false
        },
    },
    content: "paragraph block*",
    toDOM(node) {
        const {
            done
        } = node.attrs

        return ['li', {
                'data-type': 'todo_item',
                'data-done': done.toString(),
            },
            ['span', {
                class: 'todo-checkbox todo-checkbox-unchecked',
                contenteditable: "false"
            }],
            ['span', {
                class: 'todo-checkbox todo-checkbox-checked',
                contenteditable: "false"
            }],
            ['div', {
                class: 'todo-content'
            }, 0],
        ]
    },
    parseDOM: [{
        priority: 51, // Needs higher priority than other nodes that use a "li" tag
        tag: '[data-type="todo_item"]',
        getAttrs(dom) {
            return {
                done: dom.getAttribute('data-done') === 'true',
            }
        },
    }],
}

const todoListSpec = {
    group: 'block',
    content: "todo_item+ | list_item+",
    toDOM(node) {
        return ['ul', {
            'data-type': 'todo_list',
        }, 0]
    },
    parseDOM: [{
        priority: 51, // Needs higher priority than other nodes that use a "ul" tag
        tag: '[data-type="todo_list"]',
    }],
}


function getCheckboxEditable(event) {
    return true;
}

function handleClickOn(editorView, pos, node, nodePos, event) {
    // checkbox 선택
    if (node.type.name === 'btpm_checkbox') {
        // if(event.target.classList.contains('btpm_checkbox') || event.target.classList.contains('btpm_checkbox_required')){
        // BT-1701. 2021.08.23. 체크박스 가장 밑 하단 클릭 시 p태그 class명이 btpm_checkbox태그 class명으로 덮어씌워지는 문제.
        // -> node는 p태그로 들어오나 event는 btpm_checkbox태그로 들어와서 발생하는 문제.
        if (getCheckboxEditable(event)) {
            editorView.dispatch(toggleCheckboxItemAction(editorView.state, nodePos, event))
        }
        return true
    }

    // radio 선택
    if (node.type.name === 'btpm_radio') {
        if (getCheckboxEditable(event)) {
            const markupNode = toggleRadioItemAction(editorView, pos, node, nodePos, event);
            if (markupNode) editorView.dispatch(markupNode);
        }
        return true
    }

    // radio field 선택 (항목 선택)
    if (node.type.name === 'btpm_radio_field') {
        const input = event.target.previousSibling;

        // radio 의 checked 값을 상위 dataset 에 업데이트
        if (input && input.nodeName === "INPUT") {
            // disabled 속성 있을 경우 동작 중지
            if (input.disabled) return;
            const dataId = node.attrs["data-id"];

            const newNode = editorView.state.tr.setNodeMarkup(nodePos, null, {
                "data-id": dataId,
                "data-align": node.attrs["data-align"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-label-1": node.attrs["data-input-label-1"],
                "data-input-label-2": node.attrs["data-input-label-2"],
                "data-input-checked": input.value,
                "data-alert-message": node.attrs["data-alert-message"],
            });

            editorView.dispatch(newNode);
            
            let targetNode = null;
            editorView.state.doc.descendants((node, pos) => {
                if (node.attrs["data-id"] === dataId) {
                    targetNode = node;
                    return false;
                }
            });

            return showAlertOnRadioField({ editorView, node: targetNode, pos: nodePos });
        }
    }

    // radio group 선택
    if (node.type.name === 'btpm_radio_group') {
        const input = event.target.previousSibling;
        
        // radio 의 checked 값을 상위 dataset 에 업데이트
        if (input && input.nodeName === "INPUT") {
            // disabled 속성 있을 경우 동작 중지
            if (input.disabled) return;
            const dataId = node.attrs["data-id"];

            const newNode = editorView.state.tr.setNodeMarkup(nodePos, null, {
                "data-id": dataId,
                "data-align": node.attrs["data-align"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-labels": node.attrs["data-input-labels"],
                "data-input-checked": input.value,
                "data-user-limit-type": node.attrs["data-user-limit-type"],
            });

            editorView.dispatch(newNode);
        }
    }
}

function showAlertOnRadioField({ editorView, node, pos }) {
    const state = editorView.state;
    const message = node.attrs["data-alert-message"];
    const value = Number(node.attrs["data-input-checked"]);
    const required = node.attrs["data-required"] === 'true' || node.attrs["data-required"] === true ? true : false;

    if (value === 2 && message) {
        gfn_show_static_popup(G_POPUP_FULL_HTML, `
            <section class="modal-body" style="padding-top: 30px;">
                <textarea disabled style="resize: vertical; padding: 0 !important; font-size: 14px; border:none !important; background-color: #fff !important;">${message}</textarea>
            </section>
            <div class="active_btn_wrap tc">
                <a class="btn__active btn_m">확인</a>
                ${!required ? '<a class="btn__cancel btn_m modal_off">취소</a>' : '' }
            </div>`,
        () => {
            $(".modal_fixed.active").addClass('dont_close_on_background_click');
            const height = $(".modal_fixed.active textarea").prop('scrollHeight');
            $(".modal_fixed.active textarea").height(`${height}px`);
        }, () => {
            // 확인 callback
            if (!required) return;

            const newNode = state.tr.setNodeMarkup(pos, null, {
                "data-id": node.attrs["data-id"],
                "data-align": node.attrs["data-align"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-label-1": node.attrs["data-input-label-1"],
                "data-input-label-2": node.attrs["data-input-label-2"],
                "data-input-checked": 0,
                "data-alert-message": node.attrs["data-alert-message"],
            });

            editorView.dispatch(newNode);
        },() => {
            // 취소 callback

            const newNode = state.tr.setNodeMarkup(pos, null, {
                "data-id": node.attrs["data-id"],
                "data-align": node.attrs["data-align"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-label-1": node.attrs["data-input-label-1"],
                "data-input-label-2": node.attrs["data-input-label-2"],
                "data-input-checked": 0,
                "data-alert-message": node.attrs["data-alert-message"],
            });

            editorView.dispatch(newNode);
        }, 'modal1');
    }
    return true;
}

function toggleCheckboxItemAction(state, pos, event) {
    let target = event.target.classList;

    if (target.contains('btpm_checked') && target.contains("btpm_checkbox")) {
        return state.tr.setNodeMarkup(pos, null, {
            class: 'btpm_checkbox',
            "data-type": (event.target.dataset.dataType !== undefined) ? event.target.dataset.dataType : '',
            "data-group-id": (event.target.dataset.groupId !== undefined) ? event.target.dataset.groupId : '',
            "data-user-limit-type": (event.target.dataset.userLimitType !== undefined) ? event.target.dataset.userLimitType : '',
            "data-alert-message": (event.target.dataset.alertMessage !== undefined) ? event.target.dataset.alertMessage : '',
            "data-checkbox-type": (event.target.dataset.checkboxType !== undefined) ? event.target.dataset.checkboxType : ''
        });
    } else if (!target.contains("btpm_checked") && target.contains("btpm_checkbox")) {
        // 210817 체크박스 오작동으로 수정
        if (event.target.dataset.alertMessage !== undefined && event.target.dataset.alertMessage.length > 0) {
            gfn_open_modal_popup_by_element_id('alert_message_popup_wrapper', 'alert_message_popup', function () {
                const el = document.querySelector('.modal_section');
                const _htmlText = '<div class="modal_title bor_btm"><p class="lg_p">경고 메시지</p></div>' +
                    '<p class="modal_p">' + event.target.dataset.alertMessage + '</p>' +
                    '<div class="active_btn_wrap tc">' +
                    '<a class="btn__active btn_m modal_off">확인</a>' +
                    '</div>';
                el.innerHTML = _htmlText;
            }, 'modal1');
        }
        return state.tr.setNodeMarkup(pos, null, {
            class: 'btpm_checkbox btpm_checked',
            "data-type": (event.target.dataset.dataType !== undefined) ? event.target.dataset.dataType : '',
            "data-group-id": (event.target.dataset.groupId !== undefined) ? event.target.dataset.groupId : '',
            "data-user-limit-type": (event.target.dataset.userLimitType !== undefined) ? event.target.dataset.userLimitType : '',
            "data-alert-message": (event.target.dataset.alertMessage !== undefined) ? event.target.dataset.alertMessage : '',
            "data-checkbox-type": (event.target.dataset.checkboxType !== undefined) ? event.target.dataset.checkboxType : ''
        });
    } else if (target.contains('btpm_checked_required') && target.contains("btpm_checkbox_required")) {
        return state.tr.setNodeMarkup(pos, null, {
            class: 'btpm_checkbox_required',
            "data-type": (event.target.dataset.dataType !== undefined) ? event.target.dataset.dataType : '',
            "data-group-id": (event.target.dataset.groupId !== undefined) ? event.target.dataset.groupId : '',
            "data-user-limit-type": (event.target.dataset.userLimitType !== undefined) ? event.target.dataset.userLimitType : '',
            "data-alert-message": (event.target.dataset.alertMessage !== undefined) ? event.target.dataset.alertMessage : '',
            "data-checkbox-type": (event.target.dataset.checkboxType !== undefined) ? event.target.dataset.checkboxType : ''
        });
    } else if (!target.contains('btpm_checked_required') && target.contains("btpm_checkbox_required")) {
        if (event.target.dataset.alertMessage !== undefined && event.target.dataset.alertMessage.length > 0) {
            gfn_open_modal_popup_by_element_id('alert_message_popup_wrapper', 'alert_message_popup', function () {
                const el = document.querySelector('.modal_section');
                const _htmlText = '<div class="modal_title bor_btm"><p class="lg_p">경고 메시지</p></div>' +
                    '<p class="modal_p">' + event.target.dataset.alertMessage + '</p>' +
                    '<div class="active_btn_wrap tc">' +
                    '<a class="btn__active btn_m modal_off">확인</a>' +
                    '</div>';
                el.innerHTML = _htmlText;
            }, 'modal1');
        }
        return state.tr.setNodeMarkup(pos, null, {
            class: 'btpm_checkbox_required btpm_checked_required',
            "data-type": (event.target.dataset.dataType !== undefined) ? event.target.dataset.dataType : '',
            "data-group-id": (event.target.dataset.groupId !== undefined) ? event.target.dataset.groupId : '',
            "data-user-limit-type": (event.target.dataset.userLimitType !== undefined) ? event.target.dataset.userLimitType : '',
            "data-alert-message": (event.target.dataset.alertMessage !== undefined) ? event.target.dataset.alertMessage : '',
            "data-checkbox-type": (event.target.dataset.checkboxType !== undefined) ? event.target.dataset.checkboxType : ''
        });
    }
}

function toggleRadioItemAction(editorView, pos, node, nodePos, e) {
    const state = editorView.state;
    const target = e.target;
    const id = node.attrs['data-id']; // 선택된 radio id
    const radioEls = editorView.dom.querySelectorAll('btpm_radio[data-id="'+ id + '"]');
    let warning = false;
    
    // 다른 node 는 return
    if (target.nodeName !== 'BTPM_RADIO') return;

    if (!target.classList.contains('btpm_radio_checked')) {
        radioEls.forEach(item => {
            if (item.classList.contains('btpm_radio_checked')) warning = true;
        });
    }

    if (warning) {
        gfn_open_modal_popup_by_element_id('alert_message_popup_wrapper', 'alert_message_popup', function () {
            const el = document.querySelector('.modal_section');
            const _htmlText = '<div class="modal_title bor_btm"><p class="lg_p">경고 메시지</p></div>' +
                '<p class="modal_p">한 가지 항목만 선택할 수 있습니다.</p>' +
                '<div class="active_btn_wrap tc">' +
                '<a class="btn__active btn_m modal_off">확인</a>' +
                '</div>';
            el.innerHTML = _htmlText;
        }, 'modal1');

        return false;
    }

    if (target.dataset.alertMessage !== undefined && target.dataset.alertMessage.length > 0) {
        gfn_open_modal_popup_by_element_id('alert_message_popup_wrapper', 'alert_message_popup', function () {
            const el = document.querySelector('.modal_section');
            const _htmlText = '<div class="modal_title bor_btm"><p class="lg_p">경고 메시지</p></div>' +
                '<p class="modal_p">' + target.dataset.alertMessage + '</p>' +
                '<div class="active_btn_wrap tc">' +
                '<a class="btn__active btn_m modal_off">확인</a>' +
                '</div>';
            el.innerHTML = _htmlText;
        }, 'modal1');
    }
    
    let className = (target.classList.contains("btpm_radio_required")) ? "btpm_radio_required" : "btpm_radio";
    if (!target.classList.contains("btpm_radio_checked")) className += " btpm_radio_checked";

    let data = {
        class: className,
        "data-id": (target.dataset.id != null) ? target.dataset.id : 0,
        "data-order": (target.dataset.order != null) ? target.dataset.order : 0,
        "data-alert-message": (target.dataset.alertMessage != null) ? target.dataset.alertMessage : '',
        "data-user-limit-type": (target.dataset.dataUserLimitType != null) ? target.dataset.dataUserLimitType : 0,
    };

    return  state.tr.setNodeMarkup(pos, null, data);
}

/** 이미지업로드 */
let placeholderPlugin = new Plugin({
    state: {
        init() {
            return DecorationSet.empty
        },
        apply(tr, set) {
            // Adjust decoration positions to changes made by the transaction
            set = set.map(tr.mapping, tr.doc)
            // See if the transaction adds or removes any placeholders
            let action = tr.getMeta(this)
            if (action && action.add) {
                let widget = document.createElement("placeholder")
                let deco = Decoration.widget(action.add.pos, widget, {
                    id: action.add.id
                })
                set = set.add(tr.doc, [deco])
            } else if (action && action.remove) {
                set = set.remove(set.find(null, null,
                    spec => spec.id == action.remove.id))
            }
            return set
        }
    },
    props: {
        decorations(state) {
            return this.getState(state)
        }
    }
})

function findPlaceholder(state, id) {
    let decos = placeholderPlugin.getState(state)
    let found = decos.find(null, null, spec => spec.id == id)
    return found.length ? found[0].from : null
}


export function startImageUpload(view, file) {
    // A fresh object to act as the ID for this upload
    let id = {}

    // Replace the selection with a placeholder
    let tr = view.state.tr
    if (!tr.selection.empty) tr.deleteSelection()
    tr.setMeta(placeholderPlugin, {
        add: {
            id,
            pos: tr.selection.from
        }
    })
    view.dispatch(tr)

    if (file) {
        var FR = new FileReader();
        FR.onload = function (e) {
            let url = e.target.result

            let pos = findPlaceholder(view.state, id)
            // If the content around the placeholder has been deleted, drop
            // the image
            if (pos == null) return
            // Otherwise, insert it at the placeholder's position, and remove
            // the placeholder
            const _img = new Image();
            _img.src = url;
            _img.onload = function () {
                let imgWidth = _img.naturalWidth;
                const imgHeight = _img.naturalHeight;
                // width:imgWidth
                if (imgWidth && imgWidth > 788) {
                    imgWidth = 788;
                }
                let img = buptleSchema.nodes.resizableImage.create({
                    src: url,
                    style: 'width: ' + imgWidth + 'px'
                })
                view.dispatch(view.state.tr
                    .replaceWith(pos, pos, img)
                    .setMeta(placeholderPlugin, {
                        remove: {
                            id
                        }
                    }))
            };
        };

        FR.readAsDataURL(file);
    }

    return;
}

// function uploadFile(files) { }


let _editorSpec = null;
export let buptleSchema = null;
//import {buptle_menu} from "./buptle_menu"
// import {commentPlugin, commentUI, addAnnotation, annotationIcon} from "./comment_1.0"
/*****************************************************
 * Comment Plugin
 * 일정문제로 정식 plugin 제작은 추후에하자
 * index.js 에 모아두고. 외부에서 일부 펑션을 약식으로 오버라이드하는 방식으로 진행함
 *****************************************************/
export let annotationIcon = {
    width: 1024,
    height: 1024,
    path: "M512 219q-116 0-218 39t-161 107-59 145q0 64 40 122t115 100l49 28-15 54q-13 52-40 98 86-36 157-97l24-21 32 3q39 4 74 4 116 0 218-39t161-107 59-145-59-145-161-107-218-39zM1024 512q0 99-68 183t-186 133-257 48q-40 0-82-4-113 100-262 138-28 8-65 12h-2q-8 0-15-6t-9-15v-0q-1-2-0-6t1-5 2-5l3-5t4-4 4-5q4-4 17-19t19-21 17-22 18-29 15-33 14-43q-89-50-141-125t-51-160q0-99 68-183t186-133 257-48 257 48 186 133 68 183z"
    //path: "M-3 0h14v14H-3z",
    //path: "M3.125 7.875V10.5h1.313a1.313 1.313 0 0 0 0-2.625H3.125zm3.867-1.684a3.938 3.938 0 0 1-2.555 6.934H.5V.875H4a3.5 3.5 0 0 1 2.992 5.316zM3.125 3.5v1.75H4A.875.875 0 1 0 4 3.5h-.875z"
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
        let action = tr.getMeta(commentPlugin),
            actionType = action && action.type;
        // window.console.log('코멘트 action 타입 : ' + actionType);

        if (!action && !tr.docChanged) {
            // console.log(action)
            // console.log(tr)
            // window.console.log('코멘트 변경이 아님 그대로 return this : ' + actionType);
            // console.log('================== 1 =============================== 리턴디스')
            return this;
        }
        let base = this;
        if (actionType == "receive") {
            base = base.receive(action, tr.doc)
        }

        let decos = base.decos,
            unsent = base.unsent;
        decos = decos.map(tr.mapping, tr.doc);

        if (actionType == "newComment") {
            decos = decos.add(tr.doc, [deco(action.from, action.to, action.comment)])
            unsent = unsent.concat(action)
        } else if (actionType == "deleteComment") {
            decos = decos.remove([this.findComment(action.comment.id)])
            unsent = unsent.concat(action)
            if (action && action.ext_func) {
                action.ext_func(action.comment.id)
            }
        }
        return new CommentState(base.version, decos, unsent)
    }

    receive({
        version,
        events,
        sent
    }, doc) {
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
                if (found) result.push({
                    type: "create",
                    id: action.comment.id,
                    from: found.from,
                    to: found.to,
                    text: action.comment.text
                })
            } else {
                result.push({
                    type: "delete",
                    id: action.comment.id
                })
            }
        }
        return result
    }

    static init(config) {
        if (config.comments) {} else {
            config.comments = {
                comments: []
            }
        }
        if (config.comments.comments) {} else {
            config.comments.comments = [];
        }
        let decos = config.comments.comments.map(c => deco(c.from, c.to, new Comment(c.text, c.id, c.extra)))
        return new CommentState(config.comments.version, DecorationSet.create(config.doc, decos), [])
    }
}

function deco(from, to, comment) {
    if (comment.extra.type && 'RESOLVED' == comment.extra.type) {
        return Decoration.inline(from, to, {
            class: "comment_resolved memo_resolved _inline_comment_" + comment.id,
            id: '_inline_comment_' + comment.id
        }, {
            comment
        })
    } else {
        return Decoration.inline(from, to, {
            class: "comment memo _inline_comment_" + comment.id,
            id: '_inline_comment_' + comment.id
        }, {
            comment
        })
    }
}

export const _key = new PluginKey("commentPlugin")

export
let commentPlugin = new Plugin({
    key: _key,
    state: {
        init: CommentState.init,
        apply(tr, prev) {
            return prev.apply(tr)
        }
    },
    props: {
        decorations(state) {
            return this.getState(state).decos
        }
    }
});

let addAnnotation = function (state, dispatch) {
    return btpmAddAnnotationHandler(state, dispatch);
}

export const commentUI = function (dispatch) {
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
    let result = [],
        mapping = transform.mapping
    for (let i = 0; i < map.length; i++) {
        let span = map[i]
        let from = mapping.map(span.from, 1),
            to = mapping.map(span.to, -1)
        if (from < to) result.push(new Span(from, to, span.commit))
    }

    for (let i = 0; i < mapping.maps.length; i++) {
        let map = mapping.maps[i],
            after = mapping.slice(i + 1)
        map.forEach((_s, _e, start, end) => {
            insertIntoBlameMap(result, after.map(start, 1), after.map(end, -1), id)
        })
    }

    return result
}

function insertIntoBlameMap(map, from, to, commit) {
    if (from >= to) return
    let pos = 0,
        next
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
    let _tr = _editorView.state.tr.setMeta(trackPlugin, message)
    btpmMyHistoryDispatch(_tr)
}

export

function btpmMyHistoryDispatch(tr) {
    console.log(tr)
    let _new_state = btpmMyDispatch({
        type: "transaction",
        transaction: tr
    })

}

function setDisabled(state) {
    try {
        let input = document.querySelector("#message")
        let button = document.querySelector("#commitbutton")
        let result = trackPlugin.getState(state).uncommittedSteps.length == 0
        // console.log('setDisabled 호출');
        input.disabled = button.disabled = result
    } catch (e) {
        console.log('setDisabled 실패');
        console.log(e);
    }
}

let lastRendered = null

export

function renderCommits(state, dispatch) {
    let curState = trackPlugin.getState(state)
    if (lastRendered == curState) {
        return
    }
    lastRendered = curState

    let out = document.querySelector("#commits")
    if (!out) {
        //이런건 나중에 정리..
        return false
    }
    out.textContent = ""
    let commits = curState.commits
    commits.forEach(commit => {
        let node = elt(
            "div", {
                class: "commit"
            },
            elt("span", {
                    class: "commit-time"
                },
                commit.time.getHours() + ":" + (commit.time.getMinutes() < 10 ? "0" : "") + commit.time.getMinutes() + ":" + (commit.time.getSeconds() < 10 ? "0" : "") + commit.time.getSeconds()
            ),
            "\u00a0 " + commit.message + "\u00a0 ",
            elt("button", {
                class: "commit-revert"
            }, "revert")
        )

        try {
            node.lastChild.addEventListener("click", () => revertCommit(commit))
            node.addEventListener("mouseover", e => {
                if (!node.contains(e.relatedTarget)) {
                    dispatch(_editorView.state.tr.setMeta(highlightPlugin, {
                        add: commit
                    }))
                    // var _tr = _editorView.state.tr.setMeta(highlightPlugin, {add: commit})
                    // btpmMyHistoryDispatch(_tr)
                }
            })
            node.addEventListener("mouseout", e => {
                if (!node.contains(e.relatedTarget))
                    dispatch(_editorView.state.tr.setMeta(highlightPlugin, {
                        clear: commit
                    }))
                // var _tr = _editorView.state.tr.setMeta(highlightPlugin, {clear: commit})
                // btpmMyHistoryDispatch(_tr)
            })
        } catch (e) {
            console.log('====== 이벤트 attach 실패 ===========');
            console.log(e);
        }

        out.appendChild(node)
    })
}

function elt(name, attrs, ...children) {
    let dom = document.createElement(name)
    if (attrs)
        for (let attr in attrs) dom.setAttribute(attr, attrs[attr])
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

export function editorInitBySpec(editorSpec, init_function, floating) {
    _editorSpec = editorSpec;

    BTPM_BASE_ICONS_PATH = _editorSpec.icons_base_path;
    var document_html = editorSpec.get_document_html_handler();
    var comments = null;
    if (editorSpec.is_memo_activate) {
        comments = editorSpec.functions.get_comments();
        // alert('코멘트 초기화 외부에서 가져옴 : ' + comments.comments.length);
        ptpm_comment_list_target_element_id = editorSpec.div_comments_target_id;

        if (editorSpec.functions.btpmHandleCommentDraw) {
            btpmHandleCommentDraw = editorSpec.functions.btpmHandleCommentDraw.bind(this);
        }

        if (editorSpec.functions.btpmRenderCommentHandler) {
            btpmRenderCommentHandler = editorSpec.functions.btpmRenderCommentHandler.bind(this);
        }

        if (editorSpec.functions.btpmRenderCommentsHandler) {
            btpmRenderCommentsHandler = editorSpec.functions.btpmRenderCommentsHandler.bind(this);
        }

        if (editorSpec.functions.getCheckboxEditable) {
            getCheckboxEditable = editorSpec.functions.getCheckboxEditable.bind(this);
        }

    }

    return __btpmInitView(editorSpec.div_target_id, document_html, comments, floating);
}

export function editorInit(div_target_id, content_id, _comment_target_id, floating) {
    //connection = window.connection = new EditorConnection(report, "/docs/Example", target_id) // + isID[1]  <-- 이거 지네 데모에만 필요한거
    ptpm_comment_list_target_element_id = _comment_target_id;
    return __btpmInitView(div_target_id, _tmp_doc, _tmp_comments, floating);
}
// 여기다
function __btpmInitView(target_id, document_html, comments, floating) {
    let _editorState = btpmGetState(document_html, comments, floating);
    const editor = document.querySelector("#" + target_id);

    _editorView = new EditorView(editor, {
        state: _editorState,
        dispatchTransaction(transaction) {
            btpmMyDispatch({
                type: "transaction",
                transaction,
            })
        },
        nodeViews: {
            resizableImage(node, view, getPos) {
                return new FootnoteView(node, view, getPos)
            }
        },
        handleClickOn
    });
    //최초 init 콜 패치
    if (_editorSpec.is_memo_activate) {
        var comments = btpmGetAllComments()
        // alert('코멘트 초기화 내부. plugin에서 가져옴 : ' + comments.length);
        btpmHandleCommentDraw(comments, null);
    }

    return _editorView;
}

function btpmMyDispatch(action, no_note_update) {
    // window.console.log('================ action in transaction ===============');
    // console.log(action.transaction.meta.uiEvent);

    let domStatus = _editorView.dom.getAttribute('contenteditable');
    if (domStatus === 'false' && action.transaction.meta.uiEvent) return console.log('수정 금지 모드');

    let _new_state = _editorView.state.apply(action.transaction);
    _editorView.updateState(_new_state);

    if (no_note_update && true === no_note_update) {} else {
        btpmDispatchPostProcessor(_editorView, _new_state, action);
    }

    const nodeName = _new_state.selection && _new_state.selection.node && _new_state.selection.node.type.name;
    if ("image" === nodeName) {
        // window.console.log(nodeName + "<< 이미지 리사이저블 자동변환");

        const tr = _new_state.tr.replaceSelectionWith(
            buptleSchema.nodes.resizableImage.create({
                src: _new_state.selection.node.attrs.src,
                style: _new_state.selection.node.attrs.style
            })
        )
        _editorView.dispatch(tr)
    }

    return _new_state
}


/*****************************************************
 * resizable 이미지
 ****************************************************/
const resizableImage = {
    inline: true,
    attrs: {
        src: {},
        width: {
            default: "10.00em"
        },
        alt: {
            default: null
        },
        title: {
            default: null
        },
        style: {
            default: null
        },
    },
    group: "inline",
    draggable: true,
    parseDOM: [{
        priority: 51, // must be higher than the default image spec
        tag: "img[src][width]",
        getAttrs(dom) {
            return {
                src: dom.getAttribute("src"),
                title: dom.getAttribute("title"),
                alt: dom.getAttribute("alt"),
                width: dom.getAttribute("width"),
                style: dom.getAttribute("style")
            }
        }
    }],
    toDOM(node) {
        const attrs = {
            style: 'width: ' + node.attrs.width
        }
        // const attrs = {style: `width: ${node.attrs.width}`}
        //console.log("리사이저블===============");
        //console.log(node);
        //console.log(node.attrs);
        //console.log(attrs)
        return ["img", {
            style: attrs.style,
            width: node.attrs.width,
            alt: node.attrs.alt,
            title: node.attrs.title,
            src: node.attrs.src
        }]
    }
}


/*****************************************************
 * Schema 확장
 * 필수입력필드 -> class : buptleparam_content_required_none
 *                 data-param-required : 1
 * 일반입력필드 -> class : buptleparam_content_none
 *                 data-param-required : 0
 *****************************************************/

const buptleDivSpec = {
    group: "inline",
    content: "(inline* | text*)",
    toDOM(node) {
        return ["div", 0]
    },
    parseDOM: [{
        tag: "div"
    }],
}

const buptleSpanSpec = {
    attrs: {
        id: {
            default: 'tmp_span_id_' + randomID()
        },
        class: {
            default: 'btpm_default_class'
        },
        style: {
            default: ''
        },
        'data-param-id': {
            default: ''
        },
        'data-param-name': {
            default: ''
        },
        'data-param-content': {
            default: ''
        },
        'data-param-desc': {
            default: ''
        },
        'data-param-required': {
            default: ''
        },
        'data-param-kind': {
            default: ''
        },
        'data-param-display-name': {
            default: ''
        },
        'data-param-field-type': {
            default: ''
        },
        'data-param-input-type': {
            default: ''
        },
        'data-param-input-auto-type': {
            default: ''
        },
        'data-param-select-type': {
            default: ''
        },
        'data-param-select-value': {
            default: ''
        },
        'data-param-user-limit-type': {
            default: ''
        },
    },
    // content: "text*",
    // marks: "",
    // group: "block",
    // defining: true,
    content: "(inline* | text*)",
    inline: true,
    group: "inline",
    atom: true,
    toDOM(node) {
        // 프로스미러 hack 제작자는 절대로 하지 말라고 했으나 현재 두개이상의 다른 spec 을 동일한 html 태그로 변환해야하는 방법은 현재 존재하지 않는다...
        if (node.attrs.id && node.attrs.id.indexOf('tmp_span_id') !== -1) {
            //필수입력필드같은애들은 atom true
        } else {
            node.type.spec.atom = false;
            //그외의 span 태그가 들어오면 의도하지 않은 스펙이므로 p태그로 변환

            // alert(node.attrs.id);
            // return ['p',
            //     {
            //         align:node.attrs.align,
            //         style:node.attrs.style,
            //         class:node.attrs.class
            //     },
            //     0]
        }

        var rtn = {};

        if (node.attrs.id) {
            rtn.id = node.attrs.id
        }
        if (node.attrs.class) {
            rtn.class = node.attrs.class
        }
        if (node.attrs.style) {
            rtn.style = node.attrs.style
        }
        if (node.attrs['data-param-id']) {
            rtn['data-param-id'] = node.attrs['data-param-id']
        }
        if (node.attrs['data-param-name']) {
            rtn['data-param-name'] = node.attrs['data-param-name']
        }
        if (node.attrs['data-param-content']) {
            rtn['data-param-content'] = node.attrs['data-param-content']
        }
        if (node.attrs['data-param-desc']) {
            rtn['data-param-desc'] = node.attrs['data-param-desc']
        }
        if ((node.attrs['data-param-required'] + "").length !== 0) {
            rtn['data-param-required'] = node.attrs['data-param-required']
        }
        if (node.attrs['data-param-kind']) {
            rtn['data-param-kind'] = node.attrs['data-param-kind']
        }
        if (node.attrs['data-param-display-name']) {
            rtn['data-param-display-name'] = node.attrs['data-param-display-name']
        }
        if (node.attrs['data-param-field-type']) {
            rtn['data-param-field-type'] = node.attrs['data-param-field-type']
        }
        if (node.attrs['data-param-input-type']) {
            rtn['data-param-input-type'] = node.attrs['data-param-input-type']
        }
        if (node.attrs['data-param-input-auto-type']) {
            rtn['data-param-input-auto-type'] = node.attrs['data-param-input-auto-type']
        }
        if (node.attrs['data-param-select-type']) {
            rtn['data-param-select-type'] = node.attrs['data-param-select-type']
        }
        if (node.attrs['data-param-select-value']) {
            rtn['data-param-select-value'] = node.attrs['data-param-select-value']
        }
        if (node.attrs['data-param-user-limit-type']) {
            rtn['data-param-user-limit-type'] = node.attrs['data-param-user-limit-type']
        }

        return ['span', rtn, 0];
    },
    parseDOM: [{
        tag: "span[data-param-id]",
        getAttrs(dom) {
            const _getSpanClass = function(dom) {
                const content = dom.getAttribute('data-param-content') || '';
                const fieldType = dom.getAttribute('data-param-field-type') || 1;
                const required = dom.getAttribute('data-param-required') || 1;

                if (fieldType !== '3') return dom.className;
                
                if (!content || content == '""') {
                    return CONTENT_FIELD_SPEC[required].class_name;
                } else {
                    return dom.className;
                }
            }

            if (1 == 1) {
                return {
                    id: dom.id,
                    // 자동입력 항목 추가로 인한 커스텀
                    // class: dom.className,
                    class: _getSpanClass(dom),
                    style: dom.getAttribute("style"),
                    'data-param-id': dom.getAttribute('data-param-id'),
                    'data-param-name': dom.getAttribute('data-param-name'),
                    'data-param-content': dom.getAttribute('data-param-content'),
                    'data-param-desc': dom.getAttribute('data-param-desc'),
                    'data-param-required': dom.getAttribute('data-param-required'),
                    'data-param-kind': dom.getAttribute('data-param-kind'),
                    'data-param-display-name': dom.getAttribute('data-param-display-name'),
                    'data-param-field-type': dom.getAttribute('data-param-field-type'),
                    'data-param-input-type': dom.getAttribute('data-param-input-type'),
                    'data-param-input-auto-type': dom.getAttribute('data-param-input-auto-type'),
                    'data-param-select-type': dom.getAttribute('data-param-select-type'),
                    'data-param-select-value': dom.getAttribute('data-param-select-value'),
                    'data-param-user-limit-type': dom.getAttribute('data-param-user-limit-type'),
                };
            }

            var rtn = {};
            if (dom.id) {
                rtn.id = dom.id;
            }
            if (dom.class) {
                rtn.class = dom.class;
            }
            if (dom.style) {
                rtn.style = dom.getAttribute('style');
            }
            if (dom.getAttribute('data-param-id')) {
                rtn['data-param-id'] = dom.getAttribute('data-param-id');
            }
            if (dom.getAttribute('data-param-name')) {
                rtn['data-param-name'] = dom.getAttribute('data-param-name');
            }
            if (dom.getAttribute('data-param-content')) {
                rtn['data-param-content'] = dom.getAttribute('data-param-content');
            }
            if (dom.getAttribute('data-param-desc')) {
                rtn['data-param-desc'] = dom.getAttribute('data-param-desc');
            }
            if ((dom.getAttribute('data-param-required') + "").length !== 0) {
                rtn['data-param-required'] = dom.getAttribute('data-param-required');
            }
            if (dom.getAttribute('data-param-kind')) {
                rtn['data-param-kind'] = dom.getAttribute('data-param-kind');
            }
            if (dom.getAttribute('data-param-display-name')) {
                rtn['data-param-display-name'] = dom.getAttribute('data-param-display-name');
            }
            if (dom.getAttribute('data-param-field-type')) {
                rtn['data-param-field-type'] = dom.getAttribute('data-param-field-type');
            }
            if (dom.getAttribute('data-param-input-type')) {
                rtn['data-param-input-type'] = dom.getAttribute('data-param-input-type');
            }
            if (dom.getAttribute('data-param-input-auto-type')) {
                rtn['data-param-input-auto-type'] = dom.getAttribute('data-param-input-auto-type');
            }
            if (dom.getAttribute('data-param-select-type')) {
                rtn['data-param-select-type'] = dom.getAttribute('data-param-select-type');
            }
            if (dom.getAttribute('data-param-select-value')) {
                rtn['data-param-select-value'] = dom.getAttribute('data-param-select-value');
            }
            if (dom.getAttribute('data-param-user-limit-type')) {
                rtn['data-param-user-limit-type'] = dom.getAttribute('data-param-user-limit-type');
            }

            return rtn;
        }
    }]
};

const buptleLabelSpec = {
    attrs: {
        for: {
            default: ''
        },
        class: {
            default: 'btpm_label_class'
        }
    },
    // content: "text*",
    // marks: "",
    // group: "block",
    // defining: true,
    content: "(inline* | text*)",
    inline: true,
    //contentEditable : true,
    group: "inline",
    atom: true,
    toDOM(node) {
        var rtn = {};

        if (node.attrs.for) {
            rtn.for = node.attrs.for;
        }

        if (node.attrs.class) {
            rtn.class = node.attrs.class;
        }

        return ['label', rtn, 0]
    },
    parseDOM: [{
        tag: "label",
        getAttrs(dom) {
            // console.log(dom);
            // alert('getAttrs :' + dom.className );
            /**
             * class:dom.className,
              for:dom.getAttribute('for')
             * */
            var rtn = {};

            if (dom.className) {
                rtn.class = dom.className
            }
            if (dom.getAttribute('for')) {
                rtn.for = dom.getAttribute('for')
            }
            return rtn;
        }
    }]
};

const buptleCheckbox = {
    attrs: {
        class: {
            default: 'btpm_checkbox'
        },
        "data-alert-message": {
            default: ""
        }, // 경고창
        "data-checkbox-type": {
            default: ""
        }, // 동의, 비동의
        "data-type": {
            default: ""
        },
        "data-user-limit-type": {
            default: false
        }, // 유저 제한
        "data-group-id": {
            default: randomID()
        }
    },
    // content: "text*",
    // marks: "",
    // group: "block",
    // defining: true,
    inline: true,
    contentEditable: false,
    selectable: false,
    group: "inline",
    atom: true,
    toDOM(node) {
        return ['btpm_checkbox', {
            for: node.attrs.for,
            class: node.attrs.class,
            "data-alert-message": node.attrs["data-alert-message"],
            "data-checkbox-type": node.attrs["data-checkbox-type"],
            "data-group-id": node.attrs["data-group-id"],
            "data-type": node.attrs["data-type"],
            "data-user-limit-type": node.attrs["data-user-limit-type"],
        }];
    },
    parseDOM: [{
        tag: "btpm_checkbox",
        getAttrs(dom) {
            return {
                class: dom.className,
                "data-alert-message": dom.getAttribute(["data-alert-message"]),
                "data-checkbox-type": dom.getAttribute(["data-checkbox-type"]),
                "data-group-id": dom.getAttribute(["data-group-id"]),
                "data-type": dom.getAttribute("data-type"),
                "data-user-limit-type": dom.getAttribute("data-user-limit-type")
            };
        }
    }]
};

const buptleRadio = {
    attrs: {
        class: {
            default: 'btpm_radio'
        },
        "data-id": {
            default: 0
        },
        "data-order": {
            default: 0
        },
        // 경고창
        "data-alert-message": {
            default: ""
        },
        "data-type": {
            default: ""
        },
        "data-user-limit-type": {
            default: false
        },
        // 유저 제한
        "data-group-id": {
            default: randomID()
        }
    },
    inline: true,
    contentEditable: false,
    selectable: false,
    group: "inline",
    atom: true,
    toDOM(node) {
        return ['btpm_radio', {
            for: node.attrs.for,
            class: node.attrs.class,
            "data-id": node.attrs["data-id"],
            "data-order": node.attrs["data-order"],
            "data-alert-message": node.attrs["data-alert-message"],
            "data-group-id": node.attrs["data-group-id"],
            "data-type": node.attrs["data-type"],
            "data-user-limit-type": node.attrs["data-user-limit-type"],
        }];
    },
    parseDOM: [{
        tag: "btpm_radio",
        getAttrs(dom) {
            return {
                class: dom.className,
                "data-id": dom.getAttribute(["data-id"]),
                "data-order": dom.getAttribute(["data-order"]),
                "data-alert-message": dom.getAttribute(["data-alert-message"]),
                "data-group-id": dom.getAttribute(["data-group-id"]),
                "data-type": dom.getAttribute("data-type"),
                "data-user-limit-type": dom.getAttribute("data-user-limit-type")
            };
        }
    }]
};

// flex 로 하고 싶었는데 PDF 변환할 때 flex grid 사용이 불가능하다. 그냥 변환하는 Library 문제인 듯 ㄷㄷ
const buptleRadioField = {
    attrs: {
        "class": {
            default: "field-container"
        },
        "style": {
            default: "display: block; line-height: 1;"
        },
        // 배치 방향
        "data-align": {
            default: 'left'
        },
        "data-id": {
            default: ""
        },
        // 필수 or 선택 여부
        "data-required": {
            default: false
        },
        // 하위 radio 활성화 여부
        "data-disabled": {
            default: false
        },
        // 필수 or 선택 에 들어가는 text (다국어 때문에 분리)
        "data-title": {
            default: "[선택]"
        },
        // 내용
        "data-description": {
            default: ""
        },
        // 첫번 째 label 내용
        "data-input-label-1": {
            default: ""
        },
        // 두번 째 label 내용
        "data-input-label-2": {
            default: ""
        },
        // 선택 된 input value
        "data-input-checked": {
            default: 0
        },
        // 비동의 선택시 경고 팝업 내용
        "data-alert-message": {
            default: ""
        },
    },
    contentEditable: false,
    selectable: true,
    inline: false,
    group: "block",
    atom: true,
    toDOM(node) {
        const name = node.attrs["name"] ? node.attrs["name"] : `radio-name-${Math.floor(Math.random() * 100000)}`;
        const title = node.attrs["data-title"];
        const disabled = node.attrs["data-disabled"] === "true" ? node.attrs["data-disabled"] : null;
        const description = node.attrs["data-description"];
        const checked = node.attrs["data-input-checked"];

        const _createTitle = () => {
            return [
                "div",
                {
                    class: 'field-title',
                    style: "display: inline-block; padding: 0; margin: 0; vertical-align: middle;"
                },
                title
            ]
        }

        const _createDescription = () => {
            return [
                "div",
                {
                    class: "field-description",
                    style: "display: inline-block; padding: 0; margin: 0 0 0 10px; vertical-align: middle;"
                },
                description
            ]
        }

        const _createInput = (value, label) => {
            const id = `radio-${Math.floor(Math.random() * 100000)}`;

            return [
                "div", // input container
                {
                    style: "display: inline-block; margin-left: 10px;"
                }, // div 추가 attr
                [
                    "input", {
                        type: "radio",
                        name,
                        id,
                        disabled,
                        checked: Number(checked) === Number(value) ? true : null,
                        value,
                    },
                ],
                [
                    "label", {
                        for: id
                    },
                    label
                ],
            ]
        };

        let align = '';
        switch(node.attrs["data-align"]) {
            case "right": {
                align = 'text-align: right;';
                break;
            }
            case "center": {
                align = 'text-align: center;';
                break;
            }
            default: {
                align = 'text-align: left;';
            }
        }
        
        return [
            'btpm_radio_field', {
                "class": node.attrs["class"],
                "style": `${node.attrs["style"]} ${align}`,
                "data-align": node.attrs["data-align"],
                "data-id": node.attrs["data-id"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-label-1": node.attrs["data-input-label-1"],
                "data-input-label-2": node.attrs["data-input-label-2"],
                "data-input-checked": node.attrs["data-input-checked"],
                "data-alert-message": convertNewLinesAndSpacesToEntities(node.attrs["data-alert-message"]),
            },
            _createTitle(),
            _createDescription(),
            _createInput(1, node.attrs["data-input-label-1"]),
            _createInput(2, node.attrs["data-input-label-2"]),
        ];
    },
    parseDOM: [
        {
            tag: "btpm_radio_field",
            getAttrs(dom) {
                return {
                    "class": dom.getAttribute(["class"]),
                    "data-align": dom.getAttribute(["data-align"]),
                    "data-id": dom.getAttribute(["data-id"]),
                    "data-required": dom.getAttribute(["data-required"]),
                    "data-disabled": dom.getAttribute(["data-disabled"]),
                    "data-title": dom.getAttribute(["data-title"]),
                    "data-description": dom.getAttribute(["data-description"]),
                    "data-input-label-1": dom.getAttribute(["data-input-label-1"]),
                    "data-input-label-2": dom.getAttribute(["data-input-label-2"]),
                    "data-input-checked": dom.getAttribute(["data-input-checked"]),
                    "data-alert-message": dom.getAttribute(["data-alert-message"]),
                };
            },
        },
    ]
};

const buptleRadioGroup = {
    attrs: {
        "class": {
            default: "field-container"
        },
        "style": {
            default: "display: block; line-height: 1;"
        },
        // 배치 방향
        "data-align": {
            default: 'left'
        },
        "data-id": {
            default: ""
        },
        // 필수 or 선택 여부
        "data-required": {
            default: false
        },
        // 하위 radio 활성화 여부
        "data-disabled": {
            default: false
        },
        // 필수 or 선택 에 들어가는 text (다국어 때문에 분리)
        "data-title": {
            default: "[선택]"
        },
        // 내용
        "data-description": {
            default: ""
        },
        // 동적으로 생성된 radio
        "data-input-labels": {
            default: "[]"
        },
        // 선택 된 input value
        "data-input-checked": {
            default: null
        },
        'data-user-limit-type': {
            default: false
        },
    },
    contentEditable: false,
    selectable: true,
    inline: false,
    group: "block",
    atom: true,
    toDOM(node) {
        const name = node.attrs["name"] ? node.attrs["name"] : `radio-name-${Math.floor(Math.random() * 100000)}`;
        const title = node.attrs["data-title"];
        const disabled = node.attrs["data-disabled"] === "true" ? node.attrs["data-disabled"] : null;
        const description = node.attrs["data-description"];
        const checked = node.attrs["data-input-checked"];

        const _createTitle = () => {
            return [
                "div",
                {
                    class: 'field-title',
                    style: "display: inline-block; padding: 0; margin: 0; vertical-align: middle;"
                },
                title
            ]
        }

        const _createDescription = () => {
            return [
                "div",
                {
                    class: "field-description",
                    style: "display: inline-block; padding: 0; margin: 0 0 0 10px; vertical-align: middle;"
                },
                description
            ]
        }

        const _createInput = ({value, label}) => {
            const id = `radio-${Math.floor(Math.random() * 100000)}`;

            return [
                "div", // input container
                {
                    style: "display: inline-block; margin-left: 10px;"
                }, // div 추가 attr
                [
                    "input", {
                        type: "radio",
                        name,
                        id,
                        disabled,
                        checked: Number(checked) === Number(value) ? true : null,
                        value,
                    },
                ],
                [
                    "label", {
                        for: id
                    },
                    label
                ],
            ]
        };

        let align = '';
        switch(node.attrs["data-align"]) {
            case "right": {
                align = 'text-align: right;';
                break;
            }
            case "center": {
                align = 'text-align: center;';
                break;
            }
            default: {
                align = 'text-align: left;';
            }
        }
        
        const labels = JSON.parse(node.attrs["data-input-labels"]);
        return [
            'btpm_radio_group', {
                "class": node.attrs["class"],
                "style": `${node.attrs["style"]} ${align}`,
                "data-align": node.attrs["data-align"],
                "data-id": node.attrs["data-id"],
                "data-required": node.attrs["data-required"],
                "data-disabled": node.attrs["data-disabled"],
                "data-title": node.attrs["data-title"],
                "data-description": node.attrs["data-description"],
                "data-input-labels": node.attrs["data-input-labels"],
                "data-input-checked": node.attrs["data-input-checked"],
                "data-user-limit-type": node.attrs["data-user-limit-type"] || false,
            },
            _createTitle(),
            _createDescription(),
            ...labels.map((label) => _createInput(label)),
        ];
    },
    parseDOM: [
        {
            tag: "btpm_radio_group",
            getAttrs(dom) {
                return {
                    "class": dom.getAttribute(["class"]),
                    "data-align": dom.getAttribute(["data-align"]),
                    "data-id": dom.getAttribute(["data-id"]),
                    "data-required": dom.getAttribute(["data-required"]),
                    "data-disabled": dom.getAttribute(["data-disabled"]),
                    "data-title": dom.getAttribute(["data-title"]),
                    "data-description": dom.getAttribute(["data-description"]),
                    "data-input-labels": dom.getAttribute(["data-input-labels"]),
                    "data-input-checked": dom.getAttribute(["data-input-checked"]),
                    "data-user-limit-type": dom.getAttribute(["data-user-limit-type"]),
                };
            },
        },
    ]
};

const buptleInputsSpec = {
    attrs: {
        id: {
            default: ''
        },
        width: {
            default: ''
        },
        height: {
            default: ''
        },
        style: {
            default: ''
        },
        type: {
            default: 'text'
        },
        class: {
            default: 'btpm_inputs_class'
        }
    },
    content: "(inline | text*)",
    inline: true,
    group: "buptle_extra",
    atom: false,
    toDOM(node) {
        let {
            id,
            src,
            alt,
            title,
            align,
            width,
            height,
            style,
            float
        } = node.attrs;
        let type = node.attrs.type
        return ["input",
            {
                width,
                height,
                style,
                type,
                class: node.attrs.class,
                id: node.attrs.id
            },
            0
        ]
    },
    parseDOM: [{
        tag: "input",
        getAttrs(dom) {
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
    attrs: {
        align: {
            default: 'left'
        },
        style: {
            default: ''
        },
        class: {
            default: 'buptle_editor_default_p_class'
        }
    },
    content: "inline*",
    group: "block",
    toDOM(node) {
        // console.log("toDOM=====================");
        // console.log(node);
        var rtn = {};

        if (node.attrs.align) {
            rtn.align = node.attrs.align
        }
        if (node.attrs.style) {
            rtn.style = node.attrs.style
        }
        if (node.attrs.class) {
            rtn.class = node.attrs.class
        }

        return ['p', rtn, 0];
    },
    parseDOM: [{
        tag: "p",
        getAttrs(dom) {
            var _align = dom.align;
            var _style = dom.getAttribute('style');
            var _class = dom.getAttribute("class");
            var rtn = {};

            if (_align) {
                rtn.align = _align
            }
            if (_style) {
                rtn.style = _style
            }
            if (_class) {
                rtn.class = _class
            }

            return rtn;
        }
    }]
};

const buptleImgSpec = {
    inline: true,
    attrs: {
        src: {},
        alt: {
            default: null
        },
        title: {
            default: null
        },
        align: {
            default: 'left'
        },
        width: {
            default: '100%'
        },
        height: {
            default: '100%'
        },
        style: {
            default: ''
        },
        class: {
            default: 'buptle_editor_default_img_class'
        }
    },
    group: "inline",
    draggable: true,
    parseDOM: [{
        priority: 50,
        tag: "img[src]",
        getAttrs(dom) {
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
        }
    }],
    toDOM(node) {
        let {
            src,
            alt,
            title,
            align,
            width,
            height,
            style,
            float
        } = node.attrs;
        return ["img",
            {
                src,
                alt,
                title,
                align,
                width,
                height,
                style,
                float
            }
        ]
    }
};

const buptleHeadingSpec = {
    attrs: {
        level: {
            default: 1
        },
        align: {
            default: 'left'
        }
    },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [{
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
    toDOM(node) {
        return ["h" + node.attrs.level, {
            align: node.attrs.align
        }, 0]
    }
};


const nodeSpec = schema.spec.nodes.remove('heading').addBefore('code_block', 'heading', buptleHeadingSpec)
    .remove('image').addBefore('hard_break', 'image', buptleImgSpec)
    .addBefore("image", "span", buptleSpanSpec)
    .addBefore("span", "label", buptleLabelSpec)
    .addBefore("span", "btpm_checkbox", buptleCheckbox)
    .addBefore("span", "btpm_radio", buptleRadio)
    .addBefore("div", "btpm_radio_field", buptleRadioField)
    .addBefore("div", "btpm_radio_group", buptleRadioGroup)
    .remove('paragraph').addBefore('blockquote', 'paragraph', buptleParagraphSpec)
    .addBefore("buptleInputsSpec", "resizableImage", resizableImage)

// 테이블
buptleSchema = new Schema({
    nodes: addListNodes(
            nodeSpec.append(tableNodes({
                tableGroup: "block",
                cellContent: "block+",
                cellAttributes: {
                    background: {
                        default: null,
                        getFromDOM(dom) {
                            return dom.style.backgroundColor || null
                        },
                        setDOMAttr(value, attrs) {
                            if (value) attrs.style = (attrs.style || "") + `background-color: ${value};`
                        }
                    }
                }
            })), "paragraph block*", "block")
        .append({
            todo_item: todoItemSpec,
            todo_list: todoListSpec
        }),
    marks: schema.spec.marks
})

const todoItemKeymap = {
    'Enter': chainCommands(splitListItem(buptleSchema.nodes.list_item), splitListItem(buptleSchema.nodes.todo_item), newlineInCode, createParagraphNear, liftEmptyBlock, splitBlockKeepMarks, ),
    //'Enter': splitListItem(buptleSchema.nodes.todo_item),
    // 'Tab': sinkListItem(mySchema.nodes.todo_item), // use this if you want to nest todos
    'Shift-Tab': liftListItem(buptleSchema.nodes.todo_item)
}

//const wrapTodoList = null

function createLiftListItemMenu(nodeType, options) {
    return cmdItem(liftListItem(nodeType), options)
}

const liftListItemMenu = cmdItem(liftListItem(buptleSchema.nodes.list_item), {
    title: "리스트와 함께 삭제",
    icon: icons.lift
})

const liftTodoItemMenu = cmdItem(liftListItem(buptleSchema.nodes.todo_item), {
    title: "체크박스 삭제",
    icon: icons.lift
})

function getFontSize(element) {
    return parseFloat(getComputedStyle(element).fontSize);
}

class FootnoteView {
    constructor(node, view, getPos) {
        const outer = document.createElement("span")
        outer.style.position = "relative"
        //alert(node.attrs.style + " :: " + node.attrs.width);

        try {
            let _target_width = node.attrs.width === '10.00em' ? node.attrs.style.split('width:')[1].split(';')[0] :
                node.attrs.width
            //alert(_target_width + " : " + node.attrs.width);
            outer.style.width = _target_width
        } catch (e) {
            console.log("Resizable Width 계산 에러 : " + e);
            outer.style.width = '10em;'
        }

        outer.style.maxWidth = '788px';

        //outer.style.width = node.attrs.width
        //outer.style.border = "1px solid blue"
        outer.style.display = "inline-block"
        //outer.style.paddingRight = "0.25em"
        outer.style.paddingLeft = "0.25em"
        // outer.style.lineHeight = "0"; // necessary so the bottom right arrow is aligned nicely

        const img = document.createElement("img")
        img.setAttribute("src", node.attrs.src)
        img.style.width = "100%"
        img.style.setProperty('vertical-align', 'bottom', 'important');
        //img.style.border = "1px solid red"

        const handle = document.createElement("span")
        handle.style.position = "absolute"
        handle.style.bottom = "0px"
        handle.style.right = "0px"
        handle.style.width = "10px"
        handle.style.height = "10px"
        handle.style.border = "3px solid orange"
        handle.style.borderTop = "none"
        handle.style.borderLeft = "none"
        handle.style.display = "none"
        handle.style.cursor = "nwse-resize"

        handle.onmousedown = function (e) {
            e.preventDefault()

            const startX = e.pageX;
            const startY = e.pageY;

            const fontSize = getFontSize(outer)
            const startWidth = parseFloat(node.attrs.width.match(/(.+)em/)[1])

            const onMouseMove = (e) => {
                // contenteditable="false" 일 때 복사 입력 차단
                let domStatus = _editorView.dom.getAttribute('contenteditable');
                if (domStatus === 'false') return console.log('이미지 조작 금지');
                console.log('onMouseMove');
                const currentX = e.pageX;
                const currentY = e.pageY;

                const diffInPx = currentX - startX
                const diffInEm = diffInPx / fontSize

                outer.style.width = `${startWidth + diffInEm}em`
            }

            const onMouseUp = (e) => {
                e.preventDefault();

                document.removeEventListener("mousemove", onMouseMove)
                document.removeEventListener("mouseup", onMouseUp)

                const transaction = view.state.tr.setNodeMarkup(getPos(), null, {
                    src: node.attrs.src,
                    width: outer.style.width
                });

                view.dispatch(transaction)
            }

            document.addEventListener("mousemove", onMouseMove)
            document.addEventListener("mouseup", onMouseUp)
        }

        outer.appendChild(handle)
        outer.appendChild(img)

        this.dom = outer
        this.img = img
        this.handle = handle
    }

    selectNode() {
        this.img.classList.add("ProseMirror-selectednode")
        this.handle.style.display = ""
    }

    deselectNode() {
        this.img.classList.remove("ProseMirror-selectednode")
        this.handle.style.display = "none"
    }
}

// ===============================================================

function makeImageMenuItem(options) {
    let command = (state, dispatch) => {
        const nodeName = state.selection && state.selection.node && state.selection.node.type.name;

        if (nodeName === "image" || nodeName === "resizableImage") {
            if (dispatch) {
                //무조건 자동선택이므로. 여기서 resizable로 바꿀필요없다.
                //모든 이미지는 기본적으로 이제 resizable
                if (1 == 1)
                    return true

                let nodeType = nodeName === "image" ?
                    buptleSchema.nodes.resizableImage :
                    buptleSchema.nodes.image

                //일단전부 resizableImage 로 활성화되게끔한다.
                nodeType = buptleSchema.nodes.resizableImage
                //let _style = state.selection.node.attrs.style
                //alert("_style >> " + _style);
                const tr = state.tr.replaceSelectionWith(nodeType.create({
                    src: state.selection.node.attrs.src
                }))

                dispatch(tr)
            }

            return true
        }

        return false
    }

    let passedOptions = {
        run: command,
        enable(state, dispatch) {
            return command(state, dispatch)
        },
        active(state, dispatch) {
            const nodeName = state.selection && state.selection.node && state.selection.node.type.name;
            return nodeName === "resizableImage"
        }
    }

    options = {
        icon: {
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_22.svg'
            }),
        }
    }
    for (let prop in options) passedOptions[prop] = options[prop]

    return new MenuItem(passedOptions)
}

// ===============================================================




/** 메뉴 */

class MenuView {
    constructor(items, editorView) {
        this.items = items
        this.editorView = editorView
        this.dom = document.createElement("div")
        this.dom.className = "btpm_menubar"
        items.forEach(({
            dom
        }) => this.dom.appendChild(dom))
        this.update()

        this.dom.addEventListener("mousedown", e => {
            e.preventDefault()
            editorView.focus()
            items.forEach(({
                command,
                dom
            }) => {
                if (dom.contains(e.target))
                    command(editorView.state, editorView.dispatch, editorView)
            })
        })
    }

    update() {
        this.items.forEach(({
            command,
            dom
        }) => {
            let active = command(this.editorView.state, null, this.editorView)
            dom.style.display = active ? "" : "none"
        })
    }

    destroy() {
        this.dom.remove()
    }
}

// 메뉴플러그인
function menuPlugin(items) {
    return new Plugin({
        view(editorView) {
            let menuView = new MenuView(items, editorView)
            //editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom)
            $(".ProseMirror-menubar").html(menuView.dom)
            return menuView
        }
    })
}

// 아이콘생성
function icon(text, name) {
    let span = document.createElement("span")
    span.className = "ProseMirror-menuitem menuicon " + name
    span.title = name
    span.textContent = text
    return span
}

//heading 아이콘
function heading(level) {
    return {
        command: setBlockType(buptleSchema.nodes.heading, {
            level
        }),
        dom: icon("H" + level, "heading")
    }
}

//buptle table 1depth 메뉴
function table_menu_1(level) {
    //menu.fullMenu.push( [new Dropdown(tableMenu, {label:'테이블표', title:'표 제어하기', icon:table_top_menu_icon_attr})] );
    return {
        command: setBlockType(buptleSchema.nodes.heading, {
            level
        }),
        //dom: icon("표", "테이블")
        dom: crel('object', {
            type: 'image/svg+xml',
            data: BTPM_BASE_ICONS_PATH + 'editor_16.svg'
        })
    }
}

function canInsert(state, nodeType) {
    var $from = state.selection.$from;
    for (var d = $from.depth; d >= 0; d--) {
        var index = $from.index(d);
        if ($from.node(d).canReplaceWith(index, index, nodeType)) {
            return true
        }
    }
    return false
}

function markActive(state, type) {
    var ref = state.selection;
    var from = ref.from;
    var $from = ref.$from;
    var to = ref.to;
    var empty = ref.empty;
    if (empty) {
        return type.isInSet(state.storedMarks || $from.marks())
    } else {
        return state.doc.rangeHasMark(from, to, type)
    }
}

function item(label, cmd) {
    return new MenuItem({
        label,
        select: cmd,
        run: cmd
    })
}
let tableMenu = [
    item("컬럼추가(앞)", addColumnBefore),
    item("컬럼추가(뒤)", addColumnAfter),
    item("컬람삭제", deleteColumn),
    item("행추가(앞)", addRowBefore),
    item("행추가(뒤)", addRowAfter),
    item("행삭제", deleteRow),
    item("테이블삭제", deleteTable),
    item("병합하기", mergeCells),
    item("병합해제", splitCell),
]


let table_top_menu_icon_attr = {
    // width: 951,
    // height: 1024,
    path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
}

export let buptle_menu = menuPlugin([{
        command: toggleMark(buptleSchema.marks.strong),
        dom: icon("B", "strong")
    },
    {
        command: toggleMark(buptleSchema.marks.em),
        dom: icon("i", "em")
    },
    {
        command: setBlockType(buptleSchema.nodes.paragraph),
        dom: icon("p", "paragraph")
    },
    heading(1), heading(2), heading(3),
    {
        command: wrapIn(buptleSchema.nodes.blockquote),
        dom: icon(">", "blockquote")
    },
    {
        command: addAnnotation,
        dom: icon("메모", "메모남기기")
    },
    // {command: addAnnotation, dom:icon("메모", "메모남기기") },
])



function insertImageItem(nodeType) {
    return new MenuItem({
        title: "Insert image",
        label: "Image",
        enable: function enable(state) {
            return canInsert(state, nodeType)
        },
        run: function run(state, _, view) {
            var ref = state.selection;
            var from = ref.from;
            var to = ref.to;
            var attrs = null;
            if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType) {
                attrs = state.selection.node.attrs;
            }
            openPrompt({
                title: "Insert image",
                fields: {
                    src: new TextField({
                        label: "Location",
                        required: true,
                        value: attrs && attrs.src
                    }),
                    title: new TextField({
                        label: "Title",
                        value: attrs && attrs.title
                    }),
                    alt: new TextField({
                        label: "Description",
                        value: attrs ? attrs.alt : state.doc.textBetween(from, to, " ")
                    })
                },
                callback: function callback(attrs) {
                    view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)));
                    view.focus();
                }
            });
        }
    })
}

function linkItem(markType) {
    return new MenuItem({
        title: "Add or remove link",
        icon: icons.link,
        active: function active(state) {
            return markActive(state, markType)
        },
        enable: function enable(state) {
            return !state.selection.empty
        },
        run: function run(state, dispatch, view) {
            if (markActive(state, markType)) {
                prosemirrorCommands.toggleMark(markType)(state, dispatch);
                return true
            }
            openPrompt({
                title: "Create a link",
                fields: {
                    href: new TextField({
                        label: "Link target",
                        required: true
                    }),
                    title: new TextField({
                        label: "Title"
                    })
                },
                callback: function callback(attrs) {
                    toggleMark(markType, attrs)(view.state, view.dispatch);
                    view.focus();
                }
            });
        }
    })
}

export var btpm_checkbox_cmd_function = null

function cmdItem(cmd, options) {
    var passedOptions = {
        label: options.title,
        run: cmd
    };
    btpm_checkbox_cmd_function = cmd;

    for (var prop in options) {
        passedOptions[prop] = options[prop];
    }
    if ((!options.enable || options.enable === true) && !options.select) {
        passedOptions[options.enable ? "enable" : "select"] = function (state) {
            return cmd(state);
        };
    }

    return new MenuItem(passedOptions)
}

function markItem(markType, options) {
    var passedOptions = {
        active: function active(state) {
            return markActive(state, markType)
        },
        enable: true
    };
    for (var prop in options) {
        passedOptions[prop] = options[prop];
    }
    return cmdItem(toggleMark(markType), passedOptions)
}

function buildMenuItems_btpm(schema) {
    //alert(BTPM_BASE_ICONS_PATH);
    var r = {},
        type;
    if (type = schema.marks.strong) {
        r.toggleStrong = markItem(type, {
            title: "굵게",
            // icon: icons.strong
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_01.svg'
                })
            }
            //icon: {data:BTPM_BASE_ICONS_PATH+'editor_01.svg'}
        });
    }
    if (type = schema.marks.em) {
        r.toggleEm = markItem(type, {
            title: "기울이기",
            //icon: icons.em
            //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_02.svg'})}
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_02.svg'
                })
            }
        });
    }
    if (type = schema.marks.code) {
        // r.toggleCode = markItem(type, {
        //     title: "Toggle code font",
        //     icon: icons.code
        // });
    }
    if (type = schema.marks.link) {
        // r.toggleLink = linkItem(type);
    }

    if (type = schema.nodes.image) {
        //r.insertImage = insertImageItem(type);
    }
    if (type = schema.nodes.bullet_list) {
        r.wrapBulletList = wrapListItem(type, {
            title: "리스트",
            //icon: icons.bulletList
            //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_20.svg'})}
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_20.svg'
                })
            }
        });
    }
    if (type = schema.nodes.ordered_list) {
        r.wrapOrderedList = wrapListItem(type, {
            title: "순서있는 리스트",
            //icon: icons.orderedList
            //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_21.svg'})}
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_21.svg'
                })
            }
        });
    }
    if (type = schema.nodes.blockquote) {
        r.wrapBlockQuote = wrapItem(type, {
            title: "인용구",
            //icon: icons.blockquote
            //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_17.svg'})}
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_17.svg'
                })
            }
        });
    }
    if (type = schema.nodes.paragraph) {
        r.makeParagraph = blockTypeItem(type, {
            title: "기본블럭지정",
            label: "기본",
            //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_14.svg'})}
            icon: {
                dom: crel('img', {
                    style: '',
                    src: BTPM_BASE_ICONS_PATH + 'editor_14.svg'
                })
            }
        });
    }
    if (type = schema.nodes.code_block) {
        // r.makeCodeBlock = blockTypeItem(type, {
        //     title: "Change to code block",
        //     label: "Code"
        // });
    }
    if (type = schema.nodes.heading) {
        for (var i = 1; i <= 3; i++) {
            var _tmp = {
                1: '09',
                2: '10',
                3: '11',
            }
            r["makeHead" + i] = blockTypeItem(type, {
                title: "헤더" + i,
                // label: "헤더 " + i,
                //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_'+_tmp[i]+'.svg'})},
                icon: {
                    dom: crel('img', {
                        style: '',
                        src: BTPM_BASE_ICONS_PATH + 'editor_' + _tmp[i] + '.svg'
                    })
                },
                attrs: {
                    level: i
                }
            });
        }
    }
    if (type = schema.nodes.horizontal_rule) {
        var hr = type;
        r.insertHorizontalRule = new MenuItem({
            title: "Insert horizontal rule",
            label: "Horizontal rule",
            enable: function enable(state) {
                return canInsert(state, hr)
            },
            run: function run(state, dispatch) {
                dispatch(state.tr.replaceSelectionWith(hr.create()));
            }
        });
    }

    var cut = function (arr) {
        return arr.filter(function (x) {
            return x;
        });
    };
    
    r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink, r.makeParagraph, r.makeHead1, r.makeHead2, r.makeHead3])];
    r.blockMenu = [cut([r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
        liftItem,
    ])];



    r.fullMenu = r.inlineMenu.concat([
        []
    ], [
        [undoItem, redoItem]
    ], r.blockMenu);

    return r;
}


function btpmGetState(_doc, comments, floating) {
    let menu = buildMenuItems_btpm(buptleSchema)
    let pluginsArray = [keymap(todoItemKeymap)]
    let pluginsArray_2 = exampleSetup({
        schema,
        history: false,
        menuContent: menu.fullMenu,
        // 메뉴 화면 따라다니는 플로팅 효과 (메뉴를 강제로 remove 해버려서 추가)
        floatingMenu: (floating) ? true : false
    }).concat([history({
        preserveItems: true
    })]).concat(content_paste_plugin);
    pluginsArray = pluginsArray.concat(pluginsArray_2)

    pluginsArray = pluginsArray.concat(placeholderPlugin)

    menu.blockMenu[0].push(new MenuItem({
        title: "좌측정렬",
        run: function run(state, dispatch) {

            let pos = selectParentNode(state, dispatch)
            setAlignment(pos, dispatch, "letf")
        },
        class: "btpm_add_alignment_menu",
        //label:"(좌)정렬",
        //icon : { dom:crel('object', {type:'image/svg+xml', data:BTPM_BASE_ICONS_PATH + 'editor_04.svg'}) }
        icon: {
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_04.svg'
            })
        },
    }))

    menu.blockMenu[0].push(new MenuItem({
        title: "중앙",
        run: function run(state, dispatch) {

            let pos = selectParentNode(state, dispatch)
            setAlignment(pos, dispatch, "center")
        },
        class: "btpm_add_alignment_menu",
        label: "중앙정렬",
        //icon : { dom:crel('object', {type:'image/svg+xml', data:BTPM_BASE_ICONS_PATH + 'editor_05.svg'}) }
        icon: {
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_05.svg'
            })
        },
    }))

    menu.blockMenu[0].push(new MenuItem({
        title: "우측정렬",
        run: function run(state, dispatch) {

            let pos = selectParentNode(state, dispatch)
            setAlignment(pos, dispatch, "right")
        },
        class: "btpm_add_alignment_menu",
        label: "(우)정렬",
        //icon : { dom:crel('object', {type:'image/svg+xml', data:BTPM_BASE_ICONS_PATH + 'editor_06.svg'}) }
        icon: {
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_06.svg'
            })
        },
    }))

    //label:'테이블 편집'
    //let table_icon = {dom:crel('img', {style:'', src:BTPM_BASE_ICONS_PATH +'editor_23.svg'}) }
    menu.fullMenu.push([new Dropdown(tableMenu, {
        title: '표 제어하기',
        class: 'ProseMirror-tableSet'
    })]);
    menu.blockMenu[0].push(new MenuItem({
        title: "이미지업로드",
        run: function () {
            const _image_upload_btn_id = "btpm_image_upload_btn"
            let eleId = _image_upload_btn_id;
            if (document.getElementById(eleId) !== null) {

            } else {
                let _img_upload_elem = crel('input', {
                    type: 'file',
                    id: _image_upload_btn_id,
                    style: 'display:none;'
                })
                document.body.appendChild(_img_upload_elem);
                document.querySelector("#" + _image_upload_btn_id).addEventListener("change", e => {
                    if (_editorView.state.selection.$from.parent.inlineContent && e.target.files.length)
                        startImageUpload(_editorView, e.target.files[0])
                    _editorView.focus()
                })
            }
            document.getElementById(eleId).click();

        },
        class: "btpm_add_img_upload_menu",
        label: "이미지업로드",
        //icon: {dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_07.svg'})}
        icon: {
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_07.svg'
            })
        },
    }))

    menu.blockMenu[0].push(new MenuItem({
        title: "테이블 만들기",
        run: function run(state, dispatch) {

            var _table_dom = crel("div", {
                    class: "tableWrapper"
                },
                crel("table", {
                        style: "min-width:150px;"
                    },
                    crel("colgroup"),
                    crel("tbody",
                        crel('tr', crel('td', crel('p', '상단의 (테이블편집 아이콘)을 클릭하십시오.')), crel('td', crel('p', '(외곽선을 선택하여 넓이를 조정할 수 있습니다.)'))),
                        crel('tr', crel('td', crel('p', '')), crel('td', crel('p', ''))),
                        crel('tr', crel('td', crel('p', '')), crel('td', crel('p', '')))
                    )
                )
            )
            let _temp = DOMParser.fromSchema(buptleSchema).parse(_table_dom, {
                preserveWhitespace: true
            })
            dispatch(state.tr.replaceSelectionWith(_temp))
            return;
        },
        class: "btpm_add_table_menu",
        //label:"테이블",
        icon: {
            //dom:crel('object', {type:'image/svg+xml',  data: BTPM_BASE_ICONS_PATH+'editor_16.svg'})
            dom: crel('img', {
                style: '',
                src: BTPM_BASE_ICONS_PATH + 'editor_16.svg'
            }),
        }
    }))

    menu.blockMenu[0].push(makeImageMenuItem())

    if (_editorSpec.is_memo_activate) {
        pluginsArray = pluginsArray.concat(
            [
                commentPlugin, commentUI(transaction => btpmMyDispatch({
                    type: "transaction",
                    transaction
                }))
            ]
        );
        var contains_already = false;
        try {
            for (var indx = 0; indx < menu.fullMenu[0].length; indx++) {

                if ("btpm_add_comment_menu" == menu.fullMenu[0][indx].class) {
                    contains_already = true;
                    break;
                }

            }
            if (!contains_already) {
                menu.fullMenu[0].push(_annotationMenuItem)
            }
        } catch (e) {
            //pass
            console.log(e)
        }

    };

    pluginsArray = pluginsArray.concat([, columnResizing(),
        tableEditing(),
        keymap({
            "Tab": goToNextCell(1),
            "Shift-Tab": goToNextCell(-1)
        })
    ])

    if (_editorSpec.is_track_changes_activate) {
        pluginsArray = pluginsArray.concat([trackPlugin, highlightPlugin]);
        try {
            document.querySelector("#commitbutton").addEventListener("click", e => {
                e.preventDefault()
                var message = document.querySelector("#message").value;
                doCommit(message || "Unnamed")
                document.querySelector("#message").value = ""
                _editorView.focus()
            })
        } catch (e) {
            console.log(e);
        }
    }

    let editState = EditorState.create({
        doc: DOMParser.fromSchema(buptleSchema).parse(_doc, {
            preserveWhitespace: true
        }),
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
    comments: [{
        from: 0,
        to: 2,
        text: '_default comment',
        id: '1234'
    }]
}

const _annotationMenuItem = new MenuItem({
    title: "코멘트입력",
    run: addAnnotation,
    select: state => addAnnotation(state),
    icon: annotationIcon,
    class: "btpm_add_comment_menu"
})

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
});

const highlightPlugin = new Plugin({
    state: {
        init() {
            return {
                deco: DecorationSet.empty,
                commit: null
            }
        },
        apply(tr, prev, oldState, state) {
            // console.log('의도치 않은 highlightPlugin apply 가 호출됨.');
            let highlight = tr.getMeta(this)
            if (highlight && highlight.add != null && prev.commit != highlight.add) {
                // console.log('blame marker!');
                let tState = trackPlugin.getState(oldState)
                let decos = tState.blameMap
                    .filter(span => tState.commits[span.commit] == highlight.add)
                    .map(span => Decoration.inline(span.from, span.to, {
                        class: "blame-marker"
                    }))
                return {
                    deco: DecorationSet.create(state.doc, decos),
                    commit: highlight.add
                }
            } else if (highlight && highlight.clear != null && prev.commit == highlight.clear) {
                // console.log('clear!');
                return {
                    deco: DecorationSet.empty,
                    commit: null
                }
            } else if (tr.docChanged && prev.commit) {
                // console.log('else if ');
                return {
                    deco: prev.deco.map(tr.mapping, tr.doc),
                    commit: prev.commit
                }
            } else {
                // console.log('else');
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

/** paste 플러그인 */
const content_paste_plugin = new Plugin({
    props: {
        clipboardParser: {
            parseSlice: function (_dom, $context) {
                // contenteditable="false" 일 때 복사 입력 차단
                let domStatus = _editorView.dom.getAttribute('contenteditable');
                
                /** docx, hwp paste 시 컨텐츠 가공 */
                $('p', _dom).each(function (indx, _p) {
                    var _tot_text = ""
                    $(this).find("> span:not('btpm_default_class')").each(function (indx, item) {
                        var _text = $(item).text();
                        _tot_text += _text;
                        console.log("span => " + indx + " : " + item.innerHTML + " : " + _text);
                        item.remove()
                    });

                    if (_tot_text.length > 0) {
                        $(this).html("");
                        $(this).html(_tot_text);
                    }
                });

                var parser = DOMParser.fromSchema(buptleSchema);

                if (domStatus === 'false') {
                    return parser.parseSlice(_dom, {
                        preserveWhitespace: false,
                        context: null
                    });
                }

                return parser.parseSlice(_dom, {
                    preserveWhitespace: true,
                    context: $context
                });
            }
        }
    }
});

function btpmGetAllComments() {
    var _decos = _editorView.state.commentPlugin$.decos.find()
    return _decos;
}

/****
 * 외부에서 export 혹은 내부에서 재정의하여 사용하자. 플러그인 방식 제작은 추후에 다시 리팩토링..
 ***/

export

function btpmDispatchPostProcessor(_editorView, _new_state, action) {

    if (_editorSpec.is_memo_activate) {
        var comments = btpmGetAllComments()
        // console.log(comments.length + " < 메모active 되었고. 길이는 다음과 같음.");
        btpmHandleCommentDraw(comments, action);
    }

    if (_editorSpec.is_track_changes_activate) {
        /**  Track Changes 적용*/
        setDisabled(_new_state)
        renderCommits(_new_state, btpmMyHistoryDispatch)
    }

}

export

function btpmHandleCommentDraw(_comments, action) {
    var indx = 0;
    var _htmlText = '';
    // alert('코멘트갯수 안에서 : ' + _comments.length + " : " + ptpm_comment_list_target_element_id);

    for (indx in _comments) {
        var id = _comments[indx].spec.comment.id;
        var from = _comments[indx].from;
        var to = _comments[indx].to;
        var text = _comments[indx].spec.comment.text;
        console.log(_comments[indx]);
        console.log(from + " -> " + to + " : " + text);

        _htmlText += '<div class="_comments_panel" id="_comments_panel_id_' + id + '" style="background-color: white; border-radius: 5px; margin: 2px 5px 5px 5px; padding: 15px 10px 15px 10px; border: 1px solid black; border-left: 6px solid darkred;">';
        _htmlText += 'comment id : ' + id + "<br>";
        _htmlText += 'index from : ' + from + " ~ ";
        _htmlText += 'index to : ' + to;
        _htmlText += '<br> comment : <span style="font-weight: bold;">' + text + '</span>';
        _htmlText += '</div>';
    }

    // 엘리먼트 없다는 조건이 없어서 추가 (계속 오류뜸)
    const targetEl = document.querySelector("#" + ptpm_comment_list_target_element_id);
    if (targetEl) { targetEl.innerHTML = _htmlText } else { return; }

    let _comments_panels = document.querySelectorAll("._comments_panel");
    for (var i = 0; i < _comments_panels.length; i++) {
        let _tmp_id = _comments_panels[i].id.split('_comments_panel_id_')[1];
        try {
            _comments_panels[i].addEventListener("click", function () {
                btpmOnCommentBtClicked(_tmp_id);
            }, false)
        } catch (e) {
            console.log(e);
        }
    }
}

export

function btpmOnCommentBtClicked(id_suffix) {
    // alert('id_suffix : ' + id_suffix);
    //에디터 안에서 바꿔봄
    let _classesEle = document.getElementsByClassName('_inline_comment_' + id_suffix);
    let _top_pos = 0;
    for (var i = 0; i < _classesEle.length; _classesEle++) {
        _top_pos = _classesEle[i].offsetTop;
        var _target = _classesEle[i]
        setTimeout(function () {
            _target.scrollIntoView({
                block: 'center',
                behavior: 'smooth'
            });
        }, 0.3 * 1000);
    }

    let current = _editorView.state.commentPlugin$.decos.find()

    for (let i = 0; i < current.length; i++) {
        let id = current[i].spec.comment.id
        let from = current[i].from
        let to = current[i].to
        if (Number(id_suffix) === Number(id)) {
            //btpmSetSelectByOffsetFrom(to, _top_pos);
            btpmSetSelectByOffsetFrom(from, _top_pos);
            break;
        }
    }
    // setSelectByOffsetFrom(_offset_from, _top_pos);
}

/** 커서를 원하는 위치로 옮김 */
function btpmSetSelectByOffsetFrom(offset_from, top_pos) {
    _editorView.dispatch(
        _editorView.state.tr.setSelection(
            TextSelection.create(_editorView.state.tr.doc, Number(offset_from))
        )
    )
    _editorView.focus();
}

export

function btpmAddAnnotationHandler(state, dispatch) {
    if (_editorSpec.functions.addAnnotation) {
        return _editorSpec.functions.addAnnotation(commentPlugin, state, dispatch, Comment, randomID);
    }

    let sel = state.selection
    if (sel.empty) {
        return false
    }
    if (dispatch) {
        let text = prompt("입력하시오", "")

        var extra = {
            name: 'extra_name',
            info_1: 'extra_info_1',
            info_2: 'extra_info_2',
        };

        if (text)
            dispatch(state.tr.setMeta(commentPlugin, {
                type: "newComment",
                from: sel.from,
                to: sel.to,
                comment: new Comment(text, randomID(), extra)
            }))
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
    return crel("div", {
            class: "tooltip-wrapper"
        },
        crel("ul", {
                class: "commentList"
            },
            comments.map(c => btpmRenderCommentHandler(c.spec.comment, dispatch, state))))
}

export

function btpmRenderCommentHandler(comment, dispatch, state) {
    console.log('render comment original !! -> ' + comment.text);
    let btn = crel("button", {
        class: "commentDelete",
        title: "삭제하기"
    }, "삭제")

    try {
        var test_function = function (id) {
            alert(id + "를 삭제합니다.1111");
        }

        btn.addEventListener("click", () =>
            dispatch(state.tr.setMeta(commentPlugin, {
                type: "deleteComment",
                comment: comment,
                ext_func: test_function
            }))
        )
    } catch (e) {
        console.log(e);
    }

    // 선택된 코멘트 강조
    // btpmMakeFocusToSelectedComment(comment.id);
    var rtn = crel("li", {
        class: "commentText"
    }, comment.text, btn);
    return rtn
}

// 코멘트 강조
function btpmMakeFocusToSelectedComment(_comment_id) {
    var _element = document.getElementById('_comments_panel_id_' + _comment_id);
    if (_element) {

        _element.style.backgroundColor = 'lightblue;';
        document.getElementById('_comments_panel_id_' + _comment_id).style.backgroundColor = 'lightblue;';

        // alert(" << " + document.getElementById('_comments_panel_id_' + _comment_id).style.backgroundColor);
        _element.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
        });

        //에디터 안에서 바꿔봄
        let _classesEle = document.getElementsByClassName('_inline_comment_' + _comment_id);
        let _selected_btpm_text = '';
        for (var i = 0; i < _classesEle.length; _classesEle++) {
            if (i == 0) {
                _classesEle[i].style.borderLeft = '10px solid red';
                // _classesEle[i].style.border = '5px dotted red';
                // _classesEle[i].style.padding = '3px 5px 3px 5px';
                // _classesEle[i].innerHTML = '☞' + _classesEle[i].innerHTML;
            } else {}
            _selected_btpm_text += _classesEle[i].outerText;
        }
    } else {
        console.log('코멘트 div 없음 : ' + _comment_id)
    }
}

export
let getPMContentString = () => {
    if (_editorView && _editorView.state) {
        let fragment = DOMSerializer.fromSchema(buptleSchema).serializeFragment(_editorView.state.doc.content);
        let tmp = document.createElement("div");
        tmp.appendChild(fragment);
        return tmp.innerHTML;
    }
    return '';
};


export
let setPMContentFromHTML = () => {
    //        _editorView.setContent(format.fromHTML(pm.schema, "my              html", {preserveWhiteSpace: true}))
};


export
let getAllNode = function () {

    var _all_memos = _editorView.state.commentPlugin$.decos.find();
    var indx = 0;
    for (indx; indx < _all_memos.length; indx++) {
        _all_memos[indx].type.attrs.class = 'turn_off';
    }
    let _new_state = _editorView.state.apply(_editorView.state.tr);
}

function openPrompt(options) {
    var wrapper = document.body.appendChild(document.createElement("div"));
    wrapper.className = prefix;

    var mouseOutside = function (e) {
        if (!wrapper.contains(e.target)) {
            close();
        }
    };
    setTimeout(function () {
        return window.addEventListener("mousedown", mouseOutside);
    }, 50);
    var close = function () {
        window.removeEventListener("mousedown", mouseOutside);
        if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
    };

    var domFields = [];
    for (var name in options.fields) {
        domFields.push(options.fields[name].render());
    }

    var submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = prefix + "-submit";
    submitButton.textContent = "OK";
    var cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = prefix + "-cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", close);

    var form = wrapper.appendChild(document.createElement("form"));
    if (options.title) {
        form.appendChild(document.createElement("h5")).textContent = options.title;
    }
    domFields.forEach(function (field) {
        form.appendChild(document.createElement("div")).appendChild(field);
    });
    var buttons = form.appendChild(document.createElement("div"));
    buttons.className = prefix + "-buttons";
    buttons.appendChild(submitButton);
    buttons.appendChild(document.createTextNode(" "));
    buttons.appendChild(cancelButton);

    var box = wrapper.getBoundingClientRect();
    wrapper.style.top = ((window.innerHeight - box.height) / 2) + "px";
    wrapper.style.left = ((window.innerWidth - box.width) / 2) + "px";

    var submit = function () {
        var params = getValues(options.fields, domFields);
        if (params) {
            close();
            options.callback(params);
        }
    };

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
    });

    form.addEventListener("keydown", function (e) {
        if (e.keyCode == 27) {
            e.preventDefault();
            close();
        } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();
            submit();
        } else if (e.keyCode == 9) {
            window.setTimeout(function () {
                if (!wrapper.contains(document.activeElement)) {
                    close();
                }
            }, 500);
        }
    });

    var input = form.elements[0];
    if (input) {
        input.focus();
    }
}
var Field = function Field(options) {
    this.options = options;
};

// render:: (state: EditorState, props: Object) → dom.Node
// Render the field to the DOM. Should be implemented by all subclasses.

// :: (dom.Node) → any
// Read the field's value from its DOM node.
Field.prototype.read = function read(dom) {
    return dom.value
};

// :: (any) → ?string
// A field-type-specific validation function.
Field.prototype.validateType = function validateType(_value) {};

Field.prototype.validate = function validate(value) {
    if (!value && this.options.required) {
        return "Required field"
    }
    return this.validateType(value) || (this.options.validate && this.options.validate(value))
};

Field.prototype.clean = function clean(value) {
    return this.options.clean ? this.options.clean(value) : value
};

var TextField = (function (Field) {
    function TextField() {
        Field.apply(this, arguments);
    }

    if (Field) TextField.__proto__ = Field;
    TextField.prototype = Object.create(Field && Field.prototype);
    TextField.prototype.constructor = TextField;

    TextField.prototype.render = function render() {
        var input = document.createElement("input");
        input.type = "text";
        input.placeholder = this.options.label;
        input.value = this.options.value || "";
        input.autocomplete = "off";
        return input
    };

    return TextField;
}(Field));

function getValues(fields, domFields) {
    var result = Object.create(null),
        i = 0;
    for (var name in fields) {
        var field = fields[name],
            dom = domFields[i++];
        var value = field.read(dom),
            bad = field.validate(value);
        if (bad) {
            reportInvalid(dom, bad);
            return null
        }
        result[name] = field.clean(value);
    }
    return result
}

function wrapListItem(nodeType, options) {
    return cmdItem(wrapInList(nodeType, options.attrs), options)
}

function selectParentNode(state, dispatch) {
    var ref = state.selection;
    var $from = ref.$from;
    var to = ref.to;
    var pos;
    var same = $from.sharedDepth(to);

    if (same == 0) {
        return false;
    }

    // pos = $from.before(same);
    pos = $from.before(same);

    if (dispatch) {
        dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
    }

    return pos
}

function setAlignment(pos, dispatch, align) {
    let $pos = pos
    //let node = state.doc.resolve(state.selection.head).nodeBefore;
    //buptleSchema.spec.nodes.paragraph
    var _tr = _editorView.state.tr.setNodeMarkup($pos, null, {
        align: align
    })
    dispatch(_tr)
}

function convertNewLinesAndSpacesToEntities(text) {
    // 먼저 스페이스바를 &nbsp;로 변환합니다.
    let convertedText = text.replace(/ /g, '&nbsp;');

    // 윈도우즈 스타일의 줄바꿈(\r\n)을 처리합니다. (옵션)
    convertedText = convertedText.replace(/\r\n/g, '&#13;&#10;');

    // 유닉스/리눅스 스타일의 줄바꿈(\n)을 처리합니다.
    convertedText = convertedText.replace(/\n/g, '&#10;');

    return convertedText;
}