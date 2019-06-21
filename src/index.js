// export { EditorState } from "prosemirror-state";
// export { EditorView } from "prosemirror-view";
// export { Schema, DOMParser, Node } from "prosemirror-model";
// export { schema as basicSchema } from "prosemirror-schema-basic";
// export { exampleSetup } from "prosemirror-example-setup";

// export {EditorState} from "prosemirror-state";
// export {EditorView} from "prosemirror-view";
// export {Schema, DOMParser} from "prosemirror-model";
// export {schema} from "prosemirror-schema-basic";
// export {addListNodes} from "prosemirror-schema-list";
// export {exampleSetup} from "prosemirror-example-setup";
// export {collab} from "prosemirror-collab";
// export {app_index} from "app_index";





// import {EditorState} from "prosemirror-state"
// import {EditorView} from "prosemirror-view"
// import {Schema, DOMParser} from "prosemirror-model"
// import {schema} from "prosemirror-schema-basic"
// import {addListNodes} from "prosemirror-schema-list"
// import {exampleSetup} from "prosemirror-example-setup"

import {schema} from "prosemirror-schema-basic"
import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {undo, redo, history} from "prosemirror-history"
import {keymap} from "prosemirror-keymap"
import {baseKeymap} from "prosemirror-commands"




export function EditorInit(element_id, content_id){

    let state = EditorState.create({
        schema,
        plugins:[
            history(),
            keymap({"Mod-z": undo, "Mod-y": redo}),
            keymap(baseKeymap)
        ]
    });

    let view = new EditorView(document.querySelector("#"+element_id), {
        state,
        dispatchTransaction(transaction) {
            console.log("Document size went from", transaction.before.content.size,
                "to", transaction.doc.content.size)
            let newState = view.state.apply(transaction)
            view.updateState(newState)
        },

    });

    alert(" 초기화 완료 >> " + state + " : " + view);

    // //
    // const mySchema = new Schema({
    //     nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
    //     marks: schema.spec.marks
    // });
    //
    // window.view = new EditorView(document.querySelector("#"+element_id), {
    //     state: EditorState.create({
    //         doc: DOMParser.fromSchema(mySchema).parse(document.querySelector("#"+content_id)) ,
    //         plugins : exampleSetup({schema: mySchema})
    //     })
    // });
}



