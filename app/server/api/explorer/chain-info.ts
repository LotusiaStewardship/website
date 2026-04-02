export default defineEventHandler(async () => {
  const { $chronik } = useNitroApp()
  return await $chronik.getBlockchainInfo()
})
