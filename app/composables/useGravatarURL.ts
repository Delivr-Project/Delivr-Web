
async function sha256(data: string): Promise<string> {
    // Encode the string as a Uint8Array
    const msgBuffer = new TextEncoder().encode(data);
    
    // Hash the message using SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    
    // Convert the ArrayBuffer to a hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
    
    return hashHex;
}

export async function useGravatarURL(email: string): Promise<string> {

    // Trim and lowercase the email - BOTH steps are required
    const cleanEmail = email.trim().toLowerCase();
   
    // Create SHA256 hash
    const hash = await sha256(cleanEmail);

    const avatarUrl = `https://0.gravatar.com/avatar/${hash}`;
    return avatarUrl;
}