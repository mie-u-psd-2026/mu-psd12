// シートタイトルを表示し、その場で編集できる入力欄。
// コンポーネントの識別名。
const name = 'SheetTitle';

// 親が保持しているシートタイトル。
const props = {
  disabled: { type: Boolean, default: false },
  title: { type: String, default: 'Untitled Sheet' },
};

// タイトルの編集確定を親へ通知するイベント。
const emits = ['titleChanged'];

// 入力内容を確認し、タイトルを親へ通知するハンドラを返す。
function setup(props, { emit }) {
  // 入力欄の値を受け取り、空欄でなければ変更を通知する。
  function handleChange(event) {
    const title = event.target.value.trim();
    if (!title) {
      event.target.value = props.title;
      return;
    }

    event.target.value = title;
    emit('titleChanged', title);
  }

  // キーイベントを受け取り、日本語変換中でなければ編集を確定する。
  function handleEnter(event) {
    if (event.isComposing || event.keyCode === 229) return;

    event.target.blur();
  }

  return { handleChange, handleEnter };
}

// タイトルを直接編集する入力欄。
const template = `
  <input
    class="sheet-title"
    type="text"
    aria-label="Sheet Title"
    :value="title"
    :disabled="disabled"
    @change="handleChange"
    @keydown.enter="handleEnter"
  >
`;

export default { name, props, emits, setup, template };
