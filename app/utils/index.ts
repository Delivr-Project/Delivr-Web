
export namespace Utils {

	export function randomInt(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min
	}

	export function randomFrom<T>(array: T[]): T {
		return array[Math.floor(Math.random() * array.length)]!
	}

	/**
	 * Formatiert eine Dateigröße in lesbares Format
	 */
	export function formatFileSize(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB', 'TB']
		let size = bytes
		let unitIndex = 0

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}

		return `${size.toFixed(2)} ${units[unitIndex]}`
	}

	/**
	 * Formatiert ein Datum in lokales Format
	 */
	export function formatDate(date: string | Date, locale: string = 'de-DE'): string {
		return new Date(date).toLocaleDateString(locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	/**
	 * Formatiert ein Datum mit Zeit
	 */
	export function formatDateTime(date: string | Date, locale: string = 'de-DE'): string {
		return new Date(date).toLocaleDateString(locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	/**
	 * Truncates a string and adds ellipsis
	 */
	export function truncate(text: string, length: number): string {
		if (text.length <= length) return text
		return text.substring(0, length) + '...'
	}

	/**
	 * Konvertiert einen Filename zu einem Icon-Namen
	 */
	export function getLanguageIcon(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		
		const iconMap: Record<string, string> = {
			'ts': 'i-lucide-code',
			'js': 'i-lucide-code',
			'tsx': 'i-lucide-code',
			'jsx': 'i-lucide-code',
			'vue': 'i-lucide-code',
			'html': 'i-lucide-code',
			'css': 'i-lucide-code',
			'scss': 'i-lucide-code',
			'json': 'i-lucide-braces',
			'md': 'i-lucide-file-text',
			'pdf': 'i-lucide-file-pdf',
			'zip': 'i-lucide-archive',
			'png': 'i-lucide-image',
			'jpg': 'i-lucide-image',
			'gif': 'i-lucide-image'
		}

		return iconMap[ext] || 'i-lucide-file'
	}

	/**
	 * Bestimmt die Programmiersprache basierend auf File-Extension
	 */
	export function getLanguageFromExt(filename: string): string | undefined {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		
		const langMap: Record<string, string> = {
			'ts': 'TypeScript',
			'js': 'JavaScript',
			'tsx': 'TypeScript',
			'jsx': 'JavaScript',
			'vue': 'Vue',
			'py': 'Python',
			'java': 'Java',
			'cpp': 'C++',
			'c': 'C',
			'go': 'Go',
			'rs': 'Rust',
			'html': 'HTML',
			'css': 'CSS',
			'scss': 'SCSS',
			'less': 'LESS',
			'json': 'JSON',
			'yaml': 'YAML',
			'yml': 'YAML',
			'xml': 'XML'
		}

		return langMap[ext]
	}

	/**
	 * Generiert eine URL für eine GitHub-Datei
	 */
	export function getGitHubFileUrl(path: string, repo: string = 'Delivr-Project/Delivr-Web'): string {
		const baseUrl = 'https://github.com'
		return `${baseUrl}/${repo}/blob/main${path}`
	}

	/**
	 * Kopiert Text in die Zwischenablage
	 */
	export async function copyToClipboard(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Prüft, ob eine Rolle Admin-Zugriff hat
	 */
	export function hasAdminAccess(role?: string): boolean {
		return role === 'admin'
	}

	/**
	 * Prüft, ob eine Rolle Moderator-Zugriff hat
	 */
	export function hasModeratorAccess(role?: string): boolean {
		return role === 'admin' || role === 'moderator'
	}

}
