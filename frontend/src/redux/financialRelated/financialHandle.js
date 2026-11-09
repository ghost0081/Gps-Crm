import axios from 'axios';
import { getRequest, getSuccess, getFailed, getError } from './financialSlice';

export const getFinancialAccounting = (schoolId, year, month = null) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const params = { schoolId, year };
        if (month) params.month = month;
        
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/Financial/Accounting`, { params });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSuccess(result.data || null));
        }
    } catch (error) {
        dispatch(getError(error));
    }
};


