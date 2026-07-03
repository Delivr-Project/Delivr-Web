<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

definePageMeta({
    layout: 'auth'
});

useSeoMeta({
    title: "Forgot Password | Delivr",
    description: "Reset your password",
});

const toast = useToast();

const fields: AuthFormField[] = [
    {
        name: "email",
        type: "email",
        label: "Email Address",
        placeholder: "Enter your email address",
        required: true,
    },
];

const schema = z.object({
    email: z.email("Invalid email address").trim(),
});

type Schema = z.output<typeof schema>;

const submitted = ref(false);
const loading = ref(false);

async function onSubmit(payload: FormSubmitEvent<Schema>) {
    if (loading.value) return;

    loading.value = true;

    const result = await useAPI((api) => {
        return api.postAuthResetPasswordRequest({ body: payload.data });
    });

    loading.value = false;

    if (result.success) {
        submitted.value = true;
    } else {
        toast.add({
            title: "Request Failed",
            description: result.message || "An error occurred. Please try again later.",
            icon: "i-lucide-alert-circle",
            color: "error",
        });
    }
}
</script>

<template>
    <div v-if="!submitted">
        <UAuthForm
            :schema="schema"
            title="Forgot Password"
            description="Reset your password by entering your email address below."
            icon="i-lucide-mail"
            :fields="fields"
            @submit="onSubmit"
            :submit="{
                label: loading ? 'Sending...' : 'Send Reset Link',
                loading: loading,
                disabled: loading,
            }"
        >
            <template #footer>
                <div class="text-center text-sm">
                    Remembered your password?
                    <NuxtLink
                        to="/auth/login"
                        class="text-sky-400 hover:underline"
                    >
                        Login here
                    </NuxtLink>
                </div>
            </template>
        </UAuthForm>
    </div>
    <div v-else class="text-center space-y-4">
        <div class="flex justify-center">
            <div class="rounded-full bg-sky-500/10 p-3">
                <UIcon name="i-lucide-mail-check" class="size-8 text-sky-400" />
            </div>
        </div>
        <h2 class="text-xl font-semibold">Check Your Email</h2>
        <p class="text-muted-foreground text-sm max-w-sm mx-auto">
            If an account with that email address exists, we've sent a password reset link.
            Please check your inbox and follow the instructions.
        </p>
        <p class="text-muted-foreground text-xs">
            Didn't receive an email?
            <button
                type="button"
                class="text-sky-400 hover:underline"
                @click="submitted = false"
            >
                Try again
            </button>
        </p>
        <div class="pt-4">
            <NuxtLink
                to="/auth/login"
                class="text-sm text-sky-400 hover:underline"
            >
                Back to login
            </NuxtLink>
        </div>
    </div>
</template>
