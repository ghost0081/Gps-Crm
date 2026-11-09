import axios from 'axios';
import { getRequest, getSuccess, getDetailSuccess, getFailed, getError, postDone } from './parentSlice';

// Fallback for BASE_URL if environment variable is not set
const BASE_URL = process.env.REACT_APP_BASE_URL || "http://localhost:5000";

export const getParents = (schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const url = `${BASE_URL}/Parents/${schoolId}`;
        console.log('Fetching parents from:', url);
        const res = await axios.get(url);
        console.log('Parents response:', res.data);
        dispatch(getSuccess(res.data || []));
    } catch (error) {
        console.error('Error fetching parents:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: error.config?.url
        });
        dispatch(getError(error));
    }
}

export const getParentDetails = (parentId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const res = await axios.get(`${BASE_URL}/Parent/${parentId}`);
        if (res.data.message) return dispatch(getFailed(res.data.message));
        dispatch(getDetailSuccess(res.data));
    } catch (error) {
        console.error('Error fetching parent details:', error);
        dispatch(getError(error));
    }
}

export const createParent = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const res = await axios.post(`${BASE_URL}/ParentCreate`, fields, { headers: { 'Content-Type': 'application/json' } });
        if (res.data?.message && !res.data?._id) {
            dispatch(getFailed(res.data.message));
            return { error: res.data.message };
        }
        dispatch(postDone());
        return res.data;
    } catch (error) {
        const message = error.response?.data?.message || 'Could not create the parent account';
        dispatch(getFailed(message));
        return { error: message };
    }
}

export const upsertParent = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        console.log('Creating/updating parent with fields:', fields);
        const res = await axios.post(`${BASE_URL}/ParentUpsert`, fields, { headers: { 'Content-Type': 'application/json' } });
        console.log('Parent upsert response:', res.data);
        dispatch(postDone());
    } catch (error) {
        console.error('Error upserting parent:', error);
        dispatch(getError(error));
    }
}


