import axios from 'axios';
import { getRequest, getSuccess, getFailed, getError, postDone } from './assignmentSlice';

export const getAssignments = (scope, id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/AssignmentList/${scope}/${id}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const createAssignment = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.post(`${process.env.REACT_APP_BASE_URL}/AssignmentCreate`, fields, { headers: { 'Content-Type': 'application/json' } });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
}

export const submitAssignment = (assignmentId, studentId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/AssignmentSubmit`, { assignmentId, studentId }, { headers: { 'Content-Type': 'application/json' } });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
}

export const reviewAssignment = (assignmentId, studentId, marks) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/AssignmentReview`, { assignmentId, studentId, marks }, { headers: { 'Content-Type': 'application/json' } });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
}

export const setAssignmentStatus = (assignmentId, studentId, status) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/AssignmentSetStatus`, { assignmentId, studentId, status }, { headers: { 'Content-Type': 'application/json' } });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
}


