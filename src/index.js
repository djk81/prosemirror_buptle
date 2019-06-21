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

import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {Schema, DOMParser} from "prosemirror-model"
import {schema} from "prosemirror-schema-basic"
import {addListNodes} from "prosemirror-schema-list"
import {exampleSetup} from "prosemirror-example-setup"


export function EditorInit(element_id, content_id){
    //
    const mySchema = new Schema({
        nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
        marks: schema.spec.marks
    });

    window.view = new EditorView(document.querySelector("#"+element_id), {
        state: EditorState.create({
            doc: DOMParser.fromSchema(mySchema).parse(document.querySelector("#"+content_id)) ,
            plugins : exampleSetup({schema: mySchema})
        })
    });
}



