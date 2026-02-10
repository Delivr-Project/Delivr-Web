<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

const isSignupEnabled = useRuntimeConfig().public.isSignupEnabled;

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

async function onSubmit(payload: FormSubmitEvent<Schema>) {
    // @TODO: Implement forgot password when backend is implemented
    toast.add({
        title: "Feature Not Implemented",
        description: "The forgot password feature is not yet implemented.",
    });

    // const result = await useAPI().postAuthLogin({ body: payload.data });

    // if (result.success) {

    //     updateAPIClient(result.data.token);

    //     const sessionToken = useCookie("dla_session_token", {
    //         path:     '/',
    //         secure:   true,
    //         sameSite: 'strict',
    //         httpOnly: false,
    //         maxAge:   604800,
    //     });

    //     sessionToken.value = result.data.token;

    //     await useUserInfoStore.fetchAndSetUserInfo();

    //     toast.add({
    //         title: 'Login Successful',
    //         description: 'You have been logged in successfully.'
    //     });

    //     await navigateTo(redirectUrl.toString());
    //     return;

    // } else {
    //     toast.add({
    //         title: 'Login Failed',
    //         description: 'An error occurred during login.'
    //     });
    // }
}
</script>

<template>
    <UAuthForm
        :schema="schema"
        title="Forgot Password"
        description="Reset your password by entering your email address below."
        icon="i-lucide-mail"
        :fields="fields"
        @submit="onSubmit"
        :submit="{
            label: 'Send Reset Link',
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
</template>
