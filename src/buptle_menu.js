/**
 * 법틀메뉴
 **/
import {Plugin} from "prosemirror-state"
import {toggleMark, setBlockType, wrapIn} from "prosemirror-commands"

import {buptleSchema} from "./index.js"


class MenuView {
  constructor(items, editorView) {
    this.items = items
    this.editorView = editorView

    this.dom = document.createElement("div")
    this.dom.className = "menubar btpm_menubar"
    items.forEach(({dom}) => this.dom.appendChild(dom))
    this.update()

    this.dom.addEventListener("mousedown", e => {
      e.preventDefault()
      editorView.focus()
      items.forEach(({command, dom}) => {
        if (dom.contains(e.target))
          command(editorView.state, editorView.dispatch, editorView)
      })
    })
  }

  update() {
    this.items.forEach(({command, dom}) => {
      let active = command(this.editorView.state, null, this.editorView)
      dom.style.display = active ? "" : "none"
    })
  }

  destroy() { this.dom.remove() }
}

// 메뉴플러그인
function menuPlugin(items) {
  return new Plugin({
    view(editorView) {
      let menuView = new MenuView(items, editorView)
      editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom)
      return menuView
    }
  })
}

// 아이콘생성
function icon(text, name) {
  let span = document.createElement("span")
  span.className = "menuicon " + name
  span.title = name
  span.textContent = text
  return span
}

//heading 아이콘
function heading(level) {
  return {
    command: setBlockType(buptleSchema.nodes.heading, {level}),
    dom: icon("H" + level, "heading")
  }
}


export let buptle_menu = menuPlugin([
  {command: toggleMark(buptleSchema.marks.strong), dom: icon("B", "strong")},
  {command: toggleMark(buptleSchema.marks.em), dom: icon("i", "em")},
  {command: setBlockType(buptleSchema.nodes.paragraph), dom: icon("p", "paragraph")},
  heading(1), heading(2), heading(3),
  {command: wrapIn(buptleSchema.nodes.blockquote), dom: icon(">", "blockquote")}
])
