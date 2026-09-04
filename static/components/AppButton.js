const name = 'AppButton';

const props = {
  variant: { type: String, default: 'primary' },
  disabled: { type: Boolean, default: false },
};

const emits = ['press'];

// クリックイベントを受け取り、disabled状態を確認したうえで'press'を発火する
function setup(props, { emit }) {
  function handleClick(event) {
    if (props.disabled) return;

    emit('press', event);
  }

  return { handleClick };
}

const template = `
  <button type="button" class="btn" :class="'btn-' + variant" :disabled="disabled" @click="handleClick">
    <slot></slot>
  </button>
`;

export default {name, props, emits, template, setup};
