<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";
import { useUserInfoStore } from "~/composables/stores/useUserStore";
import { usePreferencesStore } from "~/composables/stores/usePreferencesStore";
import { useMailAccountsStore } from "~/composables/stores/useMailAccountsStore";
import { useSelectedMailAccountStore } from "~/composables/stores/useSelectedMailAccountStore";
import type { PostAuthPasskeyOptionsResponses } from "~/api-client/types.gen";
import { PasskeyUtils } from "~/utils/auth/passkey";

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
if (!redirectUrl.startsWith("/") || redirectUrl.startsWith("//")) {
    redirectUrl = "/";
}


const toast = useToast();

const fields: AuthFormField[] = [
    {
        name: "username",
        type: "text",
        label: "Username",
        placeholder: "Enter your username",
        autocomplete: "username webauthn",
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

const loginForm = useTemplateRef("loginForm");
const passkeyLoading = ref(false);
const passkeySupported = ref(false);

type LoginChallenge = PostAuthPasskeyOptionsResponses[200]["data"];

const CHALLENGE_MAX_AGE_MS = 4 * 60 * 1000;

// One challenge serves both the autofill prompt and the button: the server only uses it up
// when a signed response is posted.
let loginChallenge: { challenge: LoginChallenge; fetchedAt: number } | null = null;
let loginChallengeRequest: Promise<LoginChallenge | null> | null = null;
let autofillRun = 0;
let autofillRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function isFresh(fetchedAt: number) {
    return Date.now() - fetchedAt < CHALLENGE_MAX_AGE_MS;
}

onMounted(() => {
    passkeySupported.value = PasskeyUtils.isSupported();
    if (passkeySupported.value) {
        document.addEventListener("visibilitychange", refreshPasskeyAutofill);
        startPasskeyAutofill();
    }
});

onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", refreshPasskeyAutofill);
    clearTimeout(autofillRefreshTimer);
    autofillRun++;
    PasskeyUtils.cancelPending();
});

async function completeLogin(token: string, remember: boolean) {
    updateAPIClient(token);

    useAppCookies().sessionToken.set(token, {
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days
    });

    // Another user may have been logged in on this tab (logout, an expired
    // token and account deletion all end up here without a reload), so drop
    // what their session loaded and let the stores fetch this user's data.
    await Promise.all([
        usePreferencesStore().clear(),
        useMailAccountsStore().clear(),
    ]);
    useSelectedMailAccountStore().set(null);
    await useUserInfoStore().refresh();

    toast.add({
        title: "Login Successful",
        description: "You have been logged in successfully.",
    });

    await navigateTo(redirectUrl.toString());
}

function showError(title: string, description: string) {
    toast.add({
        title,
        description,
        icon: "i-lucide-alert-circle",
        color: "error",
    });
}

async function onSubmit(payload: FormSubmitEvent<Schema>) {
    const result = await useAPI((api) => {
        return api.postAuthLogin({ body: payload.data });
    }, true);

    if (!result.success) {
        if ((result.code as number) === 401) {
            showError("Invalid Username or Password", "Please check your credentials and try again.");
        } else {
            showError("Login Failed", result.message || "An error occurred during login. Please try again later.");
        }
        return;
    }

    await completeLogin(result.data.token, !!payload.data.remember);
}

async function fetchLoginChallenge() {
    const result = await useAPI((api) => api.postAuthPasskeyOptions({}), true);
    loginChallenge = result.success ? { challenge: result.data, fetchedAt: Date.now() } : null;
    return loginChallenge?.challenge ?? null;
}

async function getLoginChallenge() {
    if (loginChallenge && isFresh(loginChallenge.fetchedAt)) {
        return loginChallenge.challenge;
    }

    loginChallengeRequest ??= fetchLoginChallenge().finally(() => {
        loginChallengeRequest = null;
    });
    return await loginChallengeRequest;
}

async function finishPasskeyLogin(challengeID: string, response: PasskeyUtils.SignedResponse) {
    if (loginChallenge?.challenge.challenge_id === challengeID) {
        loginChallenge = null;
    }

    // A passkey sign-in skips the form's submit, so the checkbox is read from the form itself.
    const remember = !!loginForm.value?.state.remember;

    const result = await useAPI((api) => api.postAuthPasskey({
        body: { challenge_id: challengeID, response },
    }), true);

    if (!result.success) {
        if ((result.code as number) === 400) {
            showError("Passkey request expired", "Please try again.");
        } else {
            showError("Passkey not accepted", (result.code as number) === 401
                ? "This passkey is not registered for a Delivr account."
                : result.message || "An error occurred during login. Please try again later.");
        }
        return false;
    }

    await completeLogin(result.data.token, remember);
    return true;
}

async function startPasskeyAutofill() {
    const run = ++autofillRun;
    clearTimeout(autofillRefreshTimer);

    // Fetched even without autofill support, so the button can prompt right away.
    const challenge = await getLoginChallenge();
    if (!challenge || !(await PasskeyUtils.supportsAutofill())) return;
    if (run !== autofillRun || passkeyLoading.value) return;

    // The prompt stays open for as long as the page does, the challenge only for 5 minutes:
    // start over with a new one before it expires.
    const expiresIn = loginChallenge ? CHALLENGE_MAX_AGE_MS - (Date.now() - loginChallenge.fetchedAt) : 0;
    autofillRefreshTimer = setTimeout(refreshPasskeyAutofill, Math.max(expiresIn, 0) + 250);

    let response: PasskeyUtils.SignedResponse;
    try {
        response = await PasskeyUtils.sign(challenge.options, true);
    } catch (error) {
        if (!PasskeyUtils.isCancelled(error)) {
            showError("Passkey failed", PasskeyUtils.describeError(error));
        }
        return;
    }

    let signedIn = false;
    passkeyLoading.value = true;
    try {
        signedIn = await finishPasskeyLogin(challenge.challenge_id, response);
    } finally {
        passkeyLoading.value = false;
    }

    if (!signedIn) {
        startPasskeyAutofill();
    }
}

function refreshPasskeyAutofill() {
    // A hidden tab catches up when it becomes visible again.
    if (document.hidden || passkeyLoading.value) return;
    if (loginChallenge && isFresh(loginChallenge.fetchedAt)) return;

    startPasskeyAutofill();
}

async function signInWithPasskey() {
    passkeyLoading.value = true;
    try {
        const challenge = await getLoginChallenge();

        if (!challenge) {
            showError("Login Failed", "An error occurred during login. Please try again later.");
            return;
        }

        const response = await PasskeyUtils.sign(challenge.options);

        if (await finishPasskeyLogin(challenge.challenge_id, response)) return;
    } catch (error) {
        if (!PasskeyUtils.isCancelled(error)) {
            showError("Passkey failed", PasskeyUtils.describeError(error));
        }
    } finally {
        passkeyLoading.value = false;
    }

    startPasskeyAutofill();
}
</script>

<template>
    <UAuthForm
        ref="loginForm"
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
            <UButton
                v-if="passkeySupported"
                label="Sign in with a passkey"
                icon="i-lucide-key-round"
                color="neutral"
                variant="subtle"
                block
                class="mb-4"
                :loading="passkeyLoading"
                @click="signInWithPasskey"
            />
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
