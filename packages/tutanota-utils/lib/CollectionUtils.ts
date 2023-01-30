/**
 * Everything that is in both array1 and array2
 * This is a naive implementation, don't use it on large inputs
 */
export function intersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
	return new Set(Array.from(set1).filter((item) => set2.has(item)))
}

export function setMin(set: Set<number>): number | null {
	let min = null
	for (const item of set) {
		if (min == null || item < min) {
			min = item
		}
	}
	return min
}
