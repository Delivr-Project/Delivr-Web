<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";
import { UserStore } from "~/utils/stores/userStore";

const isSignupEnabled = useRuntimeConfig().public.isSignupEnabled;

definePageMeta({
    layout: "auth",
});

useSeoMeta({
    title: "Login | Delivr",
    description: "Login to your account",
});

const route = useRoute();
let redirectUrl = route.query.url?.toString() || "/";

// Ensure redirectUrl is a safe path within the application
if (!redirectUrl.startsWith("/")) {
    redirectUrl = "/";
}


const toast = useToast();

const fields: AuthFormField[] = [
    {
        name: "username",
        type: "text",
        label: "Username",
        placeholder: "Enter your username",
        required: true,
    },
    {
        name: "password",
        label: "Password",
        type: "password",
        placeholder: "Enter your password",
        required: true,
    },
    {
        name: "remember",
        label: "Remember me",
        type: "checkbox",
        description: "You will stay logged in for 30 days.",
    },
];

const schema = z.object({
    username: z
        .string("Username is required")
        .trim()
        .min(1, "Username is required"),
    password: z
        .string("Password is required")
        .trim()
        .min(1, "Password is required"),
    remember: z.boolean().optional(),
});

type Schema = z.output<typeof schema>;

async function onSubmit(payload: FormSubmitEvent<Schema>) {
    const result = await useAPI((api) => {
        return api.postAuthLogin({ body: payload.data });
    });

    if (result.success) {
        updateAPIClient(result.data.token);

        const sessionToken = useCookie("dla_session_token", {
            path: "/",
            secure: true,
            sameSite: "lax",
            httpOnly: false,
            maxAge: payload.data.remember ? 60 * 60 * 24 * 30 : undefined, // 30 days
        });

        sessionToken.value = result.data.token;

        await UserStore.refresh();

        toast.add({
            title: "Login Successful",
            description: "You have been logged in successfully.",
        });

        await navigateTo(redirectUrl.toString());
        return;
    } else {
        toast.add({
            title: "Login Failed",
            description: "An error occurred during login.",
        });
    }
}
</script>

<template>
    <UAuthForm
        :schema="schema"
        title="Login"
        description="Enter your credentials to access your account."
        icon="i-lucide-user"
        :fields="fields"
        @submit="onSubmit"
        :submit="{
            label: 'Login',
        }"
    >
        <template #footer>
            <div class="text-center text-sm">
                Forgot your password?
                <NuxtLink
                    to="/auth/forgot-password"
                    class="text-sky-400 hover:underline"
                >
                    Reset here
                </NuxtLink>
            </div>
            <div v-if="isSignupEnabled" class="text-center text-sm mt-2">
                Don't have an account?
                <NuxtLink
                    to="/auth/signup"
                    class="text-sky-400 hover:underline"
                >
                    Sign up
                </NuxtLink>
            </div>
        </template>
    </UAuthForm>
</template>
