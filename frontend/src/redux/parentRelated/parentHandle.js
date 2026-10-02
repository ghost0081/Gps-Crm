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
        dispatch(getError(error.message));
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
        dispatch(getError(error.message));
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
        dispatch(getError(error.message));
    }
}


