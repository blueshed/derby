<script setup>
import { inject, ref } from "vue";

const rpc = inject("rpc");
const users = ref([]);

rpc.on_loaded(async () => {
  const response = await rpc.api.get_users();
  console.log(response);
  users.value = response.data;
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold">Home</h1>
    <pre>{{ rpc.state }}</pre>
    <pre>{{ JSON.stringify(users, null, 2) }}</pre>
  </div>
</template>

<style scoped></style>
