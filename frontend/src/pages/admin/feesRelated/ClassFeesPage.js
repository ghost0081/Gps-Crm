import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getFeesByClass, updateFeeStatus, getFeesSummary, bulkRegisterFees } from '../../../redux/feeRelated/feeHandle';
import { underControl } from '../../../redux/feeRelated/feeSlice';
import { 
    Paper, 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    Button, 
    Typography, 
    Box, 
    CircularProgress,
    TextField,
    MenuItem,
    Chip,
    Grid,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Menu
} from '@mui/material';
import { StyledTableCell, StyledTableRow } from '../../../components/styles';
import Popup from '../../../components/Popup';

const ClassFeesPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { id } = useParams(); // classId
    const { currentUser } = useSelector(state => state.user);
    const { feesList, feeSummary, loading, response, status } = useSelector(state => state.fee);

    // Get current month in YYYY-MM format
    const getCurrentMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [showRegisterDialog, setShowRegisterDialog] = useState(false);
    const [registerAmount, setRegisterAmount] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [selectedStudentStatus, setSelectedStudentStatus] = useState(null);
    const [selectedStudentAmount, setSelectedStudentAmount] = useState(0);

    // Generate list of months (current month and previous 11 months)
    const generateMonths = () => {
        const months = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.push({ value: monthStr, label: monthName });
        }
        return months;
    };

    const months = generateMonths();

    useEffect(() => {
        if (currentUser?._id && id && selectedMonth) {
            dispatch(getFeesByClass(id, selectedMonth, currentUser._id));
            dispatch(getFeesSummary(currentUser._id, selectedMonth, id));
        }
    }, [dispatch, currentUser, id, selectedMonth]);

    useEffect(() => {
        if (status === 'added') {
            setMessage('Fee status updated successfully');
            setShowPopup(true);
            dispatch(underControl());
            setShowRegisterDialog(false);
            setAnchorEl(null);
            // Refresh fees list
            if (currentUser?._id && id && selectedMonth) {
                dispatch(getFeesByClass(id, selectedMonth, currentUser._id));
                dispatch(getFeesSummary(currentUser._id, selectedMonth, id));
            }
        } else if (status === 'failed') {
            setMessage(response || 'Failed to update fee status');
            setShowPopup(true);
            dispatch(underControl());
        } else if (status === 'error') {
            setMessage('Network error occurred');
            setShowPopup(true);
            dispatch(underControl());
        }
    }, [status, response, dispatch, currentUser, id, selectedMonth]);

    const handleStatusChange = async (studentId, currentStatus, duration = null, feeAmount = null) => {
        if (currentStatus === 'Paid') {
            // If already paid, just mark as unpaid (single month)
            await dispatch(updateFeeStatus({
                studentId,
                month: selectedMonth,
                status: 'Unpaid',
                schoolId: currentUser._id,
                classId: id,
                amount: feeAmount || 0,
            }));
        } else {
            // If unpaid, mark as paid with optional duration
            await dispatch(updateFeeStatus({
                studentId,
                month: selectedMonth,
                status: 'Paid',
                schoolId: currentUser._id,
                classId: id,
                duration: duration || 'Monthly',
                amount: feeAmount || 0, // Use existing fee amount if available
            }));
        }
        setAnchorEl(null);
    };

    const handleBulkRegister = async () => {
        if (!registerAmount) {
            setMessage('Please enter fee amount');
            setShowPopup(true);
            return;
        }

        await dispatch(bulkRegisterFees({
            classId: id,
            startMonth: selectedMonth,
            amount: parseFloat(registerAmount),
            schoolId: currentUser._id,
            paymentMethod: 'Cash',
        }));

        setRegisterAmount('');
    };

    const handleMenuClick = (event, studentId, currentStatus, feeAmount = 0) => {
        setAnchorEl(event.currentTarget);
        setSelectedStudentId(studentId);
        setSelectedStudentStatus(currentStatus);
        setSelectedStudentAmount(feeAmount);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedStudentId(null);
        setSelectedStudentStatus(null);
        setSelectedStudentAmount(0);
    };

    const handlePrintReceipt = async (item) => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/Design/Templates`, {
                params: { schoolId: currentUser?._id, category: 'fee-receipt', defaultsOnly: '1' },
            });
            const template = (res.data || [])[0];
            if (template?._id && item.fee?._id) {
                const params = new URLSearchParams({
                    fee: item.fee._id,
                    student: item.student?._id || '',
                    autoprint: '1',
                });
                window.open(`/Admin/design/print/${template._id}?${params.toString()}`, '_blank');
                return;
            }
        } catch (err) {
            // The built-in receipt remains available when Design Studio cannot be reached.
        }
        const studentName = item.student?.name || 'Student';
        const rollNum = item.student?.rollNum || 'N/A';
        const amount = item.fee?.amount || 0;
        const date = item.lastPaidDate ? new Date(item.lastPaidDate).toLocaleDateString() : new Date().toLocaleDateString();
        const receiptNo = `REC-${Math.floor(100000 + Math.random() * 900000)}`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Fee Receipt - ${receiptNo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
                        .receipt-box { border: 2px solid #6366f1; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
                        .header h1 { margin: 0; color: #4f46e5; font-size: 24px; }
                        .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 15px; }
                        .label { color: #64748b; font-weight: bold; }
                        .value { font-weight: bold; }
                        .total-box { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: right; }
                        .total-amount { font-size: 22px; color: #10b981; font-weight: bold; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; }
                    </style>
                </head>
                <body>
                    <div class="receipt-box">
                        <div class="header">
                            <h1>SCHOOL MANAGEMENT SYSTEM</h1>
                            <p>Official Fee Payment Receipt</p>
                        </div>
                        <div class="row"><span class="label">Receipt No:</span><span class="value">${receiptNo}</span></div>
                        <div class="row"><span class="label">Payment Date:</span><span class="value">${date}</span></div>
                        <div class="row"><span class="label">Student Name:</span><span class="value">${studentName}</span></div>
                        <div class="row"><span class="label">Roll Number:</span><span class="value">${rollNum}</span></div>
                        <div class="row"><span class="label">Billing Month:</span><span class="value">${selectedMonth}</span></div>
                        <div class="row"><span class="label">Payment Status:</span><span class="value" style="color: #10b981;">PAID</span></div>
                        <div class="total-box">
                            <span class="label">Total Paid Amount: </span>
                            <span class="total-amount">₹${amount.toLocaleString()}</span>
                        </div>
                        <div class="footer">
                            <p>Thank you for your payment. Computer-generated receipt, no signature required.</p>
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (loading && !feesList.length) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Class Fees Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        variant="contained" 
                        color="primary"
                        onClick={() => setShowRegisterDialog(true)}
                    >
                        Register Fees
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/Admin/fees')}>
                        Back to Classes
                    </Button>
                </Box>
            </Box>

            {/* Month Selector */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            fullWidth
                            select
                            label="Select Month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            variant="outlined"
                        >
                            {months.map((month) => (
                                <MenuItem key={month.value} value={month.value}>
                                    {month.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {/* Summary Cards */}
            {feeSummary && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Total Students
                                </Typography>
                                <Typography variant="h5">
                                    {feeSummary.total || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Paid
                                </Typography>
                                <Typography variant="h5" color="success.main">
                                    {feeSummary.paid || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Unpaid
                                </Typography>
                                <Typography variant="h5" color="error.main">
                                    {feeSummary.unpaid || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Paid Amount
                                </Typography>
                                <Typography variant="h5" color="success.main">
                                    ₹{feeSummary.paidAmount?.toLocaleString() || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Fees Table */}
            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Roll Number</StyledTableCell>
                                <StyledTableCell>Student Name</StyledTableCell>
                                <StyledTableCell>Amount</StyledTableCell>
                                <StyledTableCell>Status</StyledTableCell>
                                <StyledTableCell>Last Paid Date</StyledTableCell>
                                <StyledTableCell>Next Payment Date</StyledTableCell>
                                <StyledTableCell align="center">Action</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        <TableBody>
                            {feesList.length > 0 ? (
                                feesList.map((item, index) => {
                                    const status = item.status || (item.fee ? item.fee.status : 'Unpaid');
                                    const amount = item.fee?.amount || 0;
                                    const lastPaidDate = item.lastPaidDate ? new Date(item.lastPaidDate) : null;
                                    const nextPaymentDate = item.nextPaymentDate ? new Date(item.nextPaymentDate) : null;
                                    
                                    return (
                                        <StyledTableRow key={item.student._id || index}>
                                            <TableCell>{item.student.rollNum}</TableCell>
                                            <TableCell>{item.student.name}</TableCell>
                                            <TableCell>₹{amount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={status}
                                                    color={status === 'Paid' ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {lastPaidDate 
                                                    ? lastPaidDate.toLocaleDateString()
                                                    : <Typography variant="body2" color="text.secondary">Never</Typography>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {nextPaymentDate 
                                                    ? (
                                                        <Typography 
                                                            variant="body2" 
                                                            color={nextPaymentDate < new Date() ? 'error' : 'text.primary'}
                                                        >
                                                            {nextPaymentDate.toLocaleDateString()}
                                                        </Typography>
                                                    )
                                                    : <Typography variant="body2" color="text.secondary">-</Typography>
                                                }
                                            </TableCell>
                                            <TableCell align="center">
                                                {status === 'Paid' ? (
                                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            onClick={() => handleStatusChange(item.student._id, status, null, amount)}
                                                            disabled={loading}
                                                            size="small"
                                                        >
                                                            Mark as Unpaid
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            color="primary"
                                                            onClick={() => handlePrintReceipt(item)}
                                                            size="small"
                                                        >
                                                            Receipt
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={(e) => handleMenuClick(e, item.student._id, status, amount)}
                                                        disabled={loading}
                                                        size="small"
                                                    >
                                                        Mark as Paid
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </StyledTableRow>
                                    );
                                })
                            ) : (
                                <StyledTableRow>
                                    <TableCell colSpan={7} align="center">
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                            No students found in this class or no fees records for the selected month.
                                        </Typography>
                                    </TableCell>
                                </StyledTableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Register Fees Dialog */}
            <Dialog open={showRegisterDialog} onClose={() => setShowRegisterDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Register Fees for Class</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Fee Amount"
                                type="number"
                                value={registerAmount}
                                onChange={(e) => setRegisterAmount(e.target.value)}
                                variant="outlined"
                                InputProps={{
                                    startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                                }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                                Registering fees for: {months.find(m => m.value === selectedMonth)?.label || selectedMonth}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Note: This will register the fee amount for all students in this class for the selected month. Duration can be set when marking fees as paid.
                            </Typography>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
                    <Button onClick={handleBulkRegister} variant="contained" disabled={loading}>
                        Register
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Duration Menu for Individual Student */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => handleStatusChange(selectedStudentId, selectedStudentStatus, 'Monthly', selectedStudentAmount)}>
                    Monthly
                </MenuItem>
                <MenuItem onClick={() => handleStatusChange(selectedStudentId, selectedStudentStatus, '3 months', selectedStudentAmount)}>
                    3 months
                </MenuItem>
                <MenuItem onClick={() => handleStatusChange(selectedStudentId, selectedStudentStatus, '6 months', selectedStudentAmount)}>
                    6 months
                </MenuItem>
                <MenuItem onClick={() => handleStatusChange(selectedStudentId, selectedStudentStatus, 'Annual', selectedStudentAmount)}>
                    Annual
                </MenuItem>
            </Menu>

            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </Box>
    );
};

export default ClassFeesPage;

