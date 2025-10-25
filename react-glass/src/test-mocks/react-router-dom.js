// Minimal mock for react-router-dom used in tests
export const useNavigate = () => () => {};
export const Link = ({ children }) => children;
export default { useNavigate };
