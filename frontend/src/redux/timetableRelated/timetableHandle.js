import axios from 'axios';
import { getRequest, getSuccess, getFailed, getError, postDone } from './timetableSlice';

export const upsertClassDay = (payload) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.post(`${process.env.REACT_APP_BASE_URL}/TimetableUpsert`, payload, { headers: { 'Content-Type': 'application/json' } });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getClassTimetable = (classId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/TimetableClass/${classId}`);
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(getSuccess(result.data));
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getTeacherTimetable = (teacherId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/TimetableTeacher/${teacherId}`);
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(getSuccess(result.data));
    } catch (error) {
        dispatch(getError(error));
    }
}








