import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { getToken, setToken } from "@/lib/session";

export const API_URL = (
	import.meta.env.VITE_API_URL ?? "https://storylens-api.iscoded.com"
).replace(/\/+$/, "");

export const axiosInstance = axios.create({ baseURL: API_URL });

axiosInstance.interceptors.request.use((config) => {
	const token = getToken();
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

axiosInstance.interceptors.response.use(
	(response) => response,
	(error: AxiosError) => {
		// An expired or revoked session (or a deleted account) signs out.
		if (error.response?.status === 401 && getToken()) setToken(null);
		return Promise.reject(error);
	},
);

/** Orval mutator: generated endpoints call the API through this. */
export const customInstance = <T>(
	config: AxiosRequestConfig,
	options?: AxiosRequestConfig,
): Promise<T> =>
	axiosInstance({ ...config, ...options }).then(({ data }) => data as T);

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;

/** The API's `{ message }` error text, or a fallback. */
export function errorMessage(
	error: unknown,
	fallback = "Something went wrong. Try again.",
): string {
	const data = (error as AxiosError<{ message?: unknown }>)?.response?.data;
	if (data && typeof data.message === "string" && data.message)
		return data.message;
	if ((error as AxiosError)?.response?.status === 422)
		return "Check the highlighted fields and try again.";
	if ((error as AxiosError)?.code === "ERR_NETWORK")
		return "The Story Lens API is unreachable.";
	return fallback;
}
