import { useSelector } from 'react-redux';


export const useGlobalBadge = () => useSelector(({ servers }) => {
	const badges = servers.map(({ badge }) => badge);
	const mentionCount = badges
		.filter((badge) => Number.isInteger(badge))
		.reduce((sum, count) => sum + count, 0);
	return mentionCount || (badges.some((badge) => !!badge) && '•') || null;
});
