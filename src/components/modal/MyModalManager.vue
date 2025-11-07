<script setup>

import { inject } from 'vue'
import { INJECTION_KEY } from '@/constants/injection-key'
import MyModal from '@/components/modal/MyModal.vue'

const loading_modal_options = inject(INJECTION_KEY.LOADING_MODAL_OPTIONS)
const error_modal_options = inject(INJECTION_KEY.ERROR_MODAL_OPTIONS)

function closeErrorModal() {
    error_modal_options.show = false
    error_modal_options.onConfirm = null
    error_modal_options.show_confirm_button = false
}

async function confirmErrorModal() {
    const handler = error_modal_options.onConfirm
    closeErrorModal()
    if (typeof handler === 'function') {
        try {
            await handler()
        } catch (error) {
            console.error(error)
        }
    }
}

</script>


<template>
    <div>
        <my-modal v-bind="loading_modal_options" @close="loading_modal_options.show = false" />
        <my-modal v-bind="error_modal_options" @close="closeErrorModal" @confirm="confirmErrorModal" />
       
    </div>
  

</template>

<style scoped></style>
