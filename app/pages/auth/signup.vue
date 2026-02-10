<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent, AuthFormField, FormError } from "@nuxt/ui";

if (!useRuntimeConfig().public.isSignupEnabled) {
    await navigateTo("/auth/login");
}

definePageMeta({
    layout: "auth",
});

useSeoMeta({
    title: "Sign Up | NowIP",
    description: "Create a new account",
});

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
        name: "email",
        type: "email",
        label: "Email Address",
        placeholder: "Enter your email address",
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
        name: "confirm_password",
        label: "Confirm Password",
        type: "password",
        placeholder: "Re-enter your password",
        required: true,
    },
];

const schema = z.object({
    username: z
        .string("Username is required")
        .trim()
        .min(5, "Must be at least 5 characters")
        .max(30, "Must be at most 30 characters")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Only alphanumeric characters and underscores are allowed"
        ),
    email: z.email("Invalid email address").trim(),
    password: z
        .string("Password is required")
        .trim()
        .min(8, "Must be at least 8 characters")
        .max(50, "Must be at most 50 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[\W_]/, "Must contain at least one special character"),
    confirm_password: z
        .string("Confirm Password is required")
        .trim()
        .min(1, "Confirm Password is required"),
});

type SingupSchema = z.output<typeof schema>;

const formState = reactive<SingupSchema>({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
});

const validate = (state: Partial<SingupSchema>): FormError[] => {
    const errors: FormError[] = [];
    if (
        state.password &&
        state.confirm_password &&
        state.password !== state.confirm_password
    ) {
        errors.push({
            name: "confirm_password",
            message: "Passwords do not match",
        });
    }
    return errors;
};

async function onSubmit(payload: FormSubmitEvent<SingupSchema>) {
    // @TODO: Implement signup when backend is implemented
    toast.add({
        title: "Feature Not Implemented",
        description: "The signup feature is not yet implemented.",
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
        :state="formState"
        :validate="validate"
        title="Sign Up"
        description="Create a new account by filling in the information below."
        icon="i-lucide-user"
        :fields="fields"
        @submit="onSubmit"
        :submit="{
            label: 'Sign Up',
        }"
    >
        <template #footer>
            <div class="text-center text-sm">
                Already have an account?
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
