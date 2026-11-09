import axios from 'axios';
import { getRequest, getSuccess, getStaffPayrollSuccess, getStaffPayrollHistorySuccess, getSummarySuccess, getFailed, getError, postDone } from './payrollSlice';

export const getPayrollByStaff = (staffId, month, schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/Staff`, {
            params: { staffId, month, schoolId }
        });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getStaffPayrollSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getPayrollBySchool = (schoolId, month) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/School`, {
            params: { schoolId, month }
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

export const updatePayrollStatus = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/Payroll/Status`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getPayrollByEmployee = (employeeId, employeeType, month, schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/Employee`, {
            params: { employeeId, employeeType, month, schoolId }
        });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getStaffPayrollSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getStaffPayrollHistory = (staffId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/Staff/${staffId}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getStaffPayrollHistorySuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getEmployeePayrollHistory = (employeeType, employeeId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/Employee/${employeeType}/${employeeId}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getStaffPayrollHistorySuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getPayrollSummary = (schoolId, month) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Payroll/Summary`, {
            params: { schoolId, month }
        });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSummarySuccess(result.data || null));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

