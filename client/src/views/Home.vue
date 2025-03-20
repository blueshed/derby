<script setup>
import { inject, ref } from "vue";

const rpc = inject("rpc");
const users = ref([]);

rpc.on_loaded(async () => {
  users.value = await rpc.api.query({ name: "get_users" })
});
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Home</h1>
    <pre>{{ rpc.state }}</pre>
    <pre>{{ JSON.stringify(users, null, 2) }}</pre>
  </div>
</template>

<style scoped></style>
