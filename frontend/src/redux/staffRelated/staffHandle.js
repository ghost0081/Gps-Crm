import axios from 'axios';
import {
    getRequest,
    getSuccess,
    getFailed,
    getError,
    postDone,
    doneSuccess
} from './staffSlice';

export const getAllStaff = (id) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Staffs/${id}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getStaffDetails = (id) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Staff/${id}`);
        if (result.data) {
            dispatch(doneSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const registerStaff = (fields) => async (dispatch) => {
    dispatch(getRequest());

    try {
        console.log('Registering staff with fields:', fields);
        const result = await axios.post(`${process.env.REACT_APP_BASE_URL}/StaffReg`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        console.log('Staff registration response:', result.data);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(postDone());
        }
    } catch (error) {
        console.error('Error registering staff:', error);
        dispatch(getError(error));
    }
}

export const updateStaffDetails = (id, fields) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.put(`${process.env.REACT_APP_BASE_URL}/Staff/${id}`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data) {
            dispatch(postDone());
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const deleteStaffMember = (id) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.delete(`${process.env.REACT_APP_BASE_URL}/Staff/${id}`);
        if (result.data) {
            dispatch(postDone());
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

