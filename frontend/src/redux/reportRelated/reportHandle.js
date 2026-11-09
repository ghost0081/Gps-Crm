import axios from 'axios';
import { getRequest, attendanceSuccess, feesSuccess, getFailed, getError } from './reportSlice';

const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export const fetchAttendanceReport = (schoolId, months = 6) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const params = { schoolId, months };
        const result = await axios.get(`${BASE_URL}/Reports/attendance`, { params });
        if (result.data?.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(attendanceSuccess(result.data || null));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const fetchFeesReport = (schoolId, months = 6) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const params = { schoolId, months };
        const result = await axios.get(`${BASE_URL}/Reports/fees`, { params });
        if (result.data?.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(feesSuccess(result.data || null));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

