export default {
  name: 'AppButton',
  props: {
    variant: { type: String, default: 'primary' },
  },
  emits: ['click'],
  template: `
    <button type="button" class="btn" :class="'btn-' + variant" @click="$emit('click')">
      <slot></slot>
    </button>
  `,
};
