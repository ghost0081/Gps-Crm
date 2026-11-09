import axios from 'axios';
import { getRequest, getSuccess, getStudentFeesSuccess, getSummarySuccess, getFailed, getError, postDone } from './feeSlice';

export const getFeesByClass = (classId, month, schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Fees/Class`, {
            params: { classId, month, schoolId }
        });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const updateFeeStatus = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/Fees/Status`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getStudentFeeHistory = (studentId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Fees/Student/${studentId}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getStudentFeesSuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getFeesSummary = (schoolId, month, classId = null) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const params = { schoolId, month };
        if (classId) params.classId = classId;
        
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Fees/Summary`, { params });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSummarySuccess(result.data || null));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const bulkRegisterFees = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.post(`${process.env.REACT_APP_BASE_URL}/Fees/BulkRegister`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (result.data.message) {
            dispatch(postDone());
        } else {
            dispatch(postDone());
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

