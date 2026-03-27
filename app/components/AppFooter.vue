<script setup lang="ts">
/*
const links = [{
  label: 'Resources',
  children: [{
    label: 'Help center'
  }, {
    label: 'Docs'
  }, {
    label: 'Roadmap'
  }, {
    label: 'Changelog'
  }]
}, {
  label: 'Features',
  children: [{
    label: 'Affiliates'
  }, {
    label: 'Portal'
  }, {
    label: 'Jobs'
  }, {
    label: 'Sponsors'
  }]
}, {
  label: 'Company',
  children: [{
    label: 'About'
  }, {
    label: 'Pricing'
  }, {
    label: 'Careers'
  }, {
    label: 'Blog'
  }]
}]

const toast = useToast()

const email = ref('')
const loading = ref(false)

function onSubmit() {
  loading.value = true

  setTimeout(() => {
    toast.add({
      title: 'Subscribed!',
      description: 'You\'ve been subscribed to our newsletter.'
    })

    loading.value = false
  }, 1000)
}
*/
</script>

<template>
  <UFooter>
    <!--
    <template #top>
      <UFooterColumns :links="links">
        <template #right>
          <form @submit.prevent="onSubmit">
            <UFormGroup
              label="Subscribe to our newsletter"
              :ui="{ container: 'mt-3' }"
            >
              <UInput
                v-model="email"
                type="email"
                placeholder="Enter your email"
                :ui="{ icon: { trailing: { pointer: '' } } }"
                required
                size="xl"
                autocomplete="off"
                class="max-w-sm"
                input-class="rounded-full"
              >
                <template #trailing>
                  <UButton
                    type="submit"
                    size="xs"
                    color="primary"
                    :label="loading ? 'Subscribing' : 'Subscribe'"
                    :loading="loading"
                  />
                </template>
              </UInput>
            </UFormGroup>
          </form>
        </template>
      </UFooterColumns>
    </template>
    -->

    <template #left>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Copyright © Lotusia 2021-{{ new Date().getFullYear() }}. All rights reserved.
      </p>
    </template>

    <template #right>
      <div class="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
        <NuxtLink to="/founders" class="hover:text-gray-700 dark:hover:text-gray-200">
          Founders
        </NuxtLink>
        <NuxtLink to="/ecosystem" class="hover:text-gray-700 dark:hover:text-gray-200">
          Ecosystem
        </NuxtLink>
        <a href="https://github.com/LotusiaStewardship" target="_blank" rel="noopener" class="hover:text-gray-700 dark:hover:text-gray-200">
          GitHub
        </a>
      </div>
    </template>
  </UFooter>
</template>
