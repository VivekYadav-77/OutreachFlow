import { useEditor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2
} from "lucide-react";

export function ComposerToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="composer-toolbar">
      <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></button>
      <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></button>
      <button type="button" title="Bold" className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
      <button type="button" title="Italic" className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
      <button type="button" title="Underline" className={editor.isActive("underline") ? "active" : ""} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
      <button type="button" title="Bullet list" className={editor.isActive("bulletList") ? "active" : ""} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
      <button type="button" title="Numbered list" className={editor.isActive("orderedList") ? "active" : ""} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
      <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={16} /></button>
      <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={16} /></button>
      <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={16} /></button>
      <label title="Text color" className="color-tool"><input type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <button type="button" title="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}><Highlighter size={16} /></button>
      <button type="button" title="Link" onClick={() => {
        const href = window.prompt("Link URL");
        if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }}><Link size={16} /></button>
      <button type="button" title="Image" onClick={() => {
        const src = window.prompt("Image URL");
        if (src) editor.chain().focus().setImage({ src }).run();
      }}><Image size={16} /></button>
    </div>
  );
}
