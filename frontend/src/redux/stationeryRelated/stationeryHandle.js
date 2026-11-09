import axios from 'axios';
import { getRequest, getSuccess, getDetailSuccess, getInvoicesSuccess, getInvoiceDetailSuccess, postDone, getFailed, getError } from './stationerySlice';

export const getStationery = (schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Stationery/${schoolId}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getStationeryDetail = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Stationery/Product/${id}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getDetailSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const addStationery = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.post(`${process.env.REACT_APP_BASE_URL}/Stationery`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};

export const updateStationery = (id, fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.put(`${process.env.REACT_APP_BASE_URL}/Stationery/${id}`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};

export const deleteStationery = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.delete(`${process.env.REACT_APP_BASE_URL}/Stationery/${id}`);
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};

export const createInvoice = (fields) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.post(`${process.env.REACT_APP_BASE_URL}/Invoice`, fields, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(postDone());
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getInvoices = (schoolId) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Invoices/${schoolId}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getInvoicesSuccess(result.data || []));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const getInvoiceDetail = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Invoice/${id}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getInvoiceDetailSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};

export const deleteInvoice = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axios.delete(`${process.env.REACT_APP_BASE_URL}/Invoice/${id}`);
        dispatch(postDone());
    } catch (error) {
        dispatch(getError(error));
    }
};


