import axios from 'axios';
import {
    getRequest,
    getSuccess,
    createSuccess,
    updateSuccess,
    getFailed,
    getError,
} from './visitorSlice';

const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export const fetchVisitors = (schoolId, params = {}) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const query = { schoolId, ...params };
        const result = await axios.get(`${BASE_URL}/Visitors`, { params: query });
        if (result.data?.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const createVisitor = (payload) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.post(`${BASE_URL}/Visitors`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data?.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(createSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const updateVisitor = (id, payload) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.put(`${BASE_URL}/Visitors/${id}`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data?.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(updateSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

