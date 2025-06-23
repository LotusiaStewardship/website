<script setup lang="ts">
const props = defineProps<{
  sats: string
}>()

const amountIntPart = computed(() => {
  return Math.floor(toXPIFromSats(props.sats))
})

const amountFloatPart = computed(() => {
  return Number(props.sats) - toSatsFromXPI(amountIntPart.value)
})
</script>

<template>
  <span>
    {{ amountIntPart.toLocaleString() }}<span
      v-if="amountFloatPart > 0"
      class="text-xs"
    >.{{ amountFloatPart }}</span> XPI
  </span>
</template>
