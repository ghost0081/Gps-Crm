import axios from 'axios';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { getSchoolLeaves, setLeaveStatus } from '../../redux/leaveRelated/leaveHandle';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    Stack,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Switch,
    Divider,
    Box,
} from '@mui/material';

const statusColor = (s) => s === 'Approved' ? 'success' : s === 'Rejected' ? 'error' : 'warning';

const formatDate = (date) => new Date(date).toLocaleDateString();
const calculateDays = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 1;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start) || isNaN(end)) return 1;
    const diff = Math.abs(end - start);
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

const TeacherLeavePage = () => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector(state => state.user);
    const { leaves, loading } = useSelector(state => state.leave);

    const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [deductionApplied, setDeductionApplied] = useState(false);
    const [deductionAmount, setDeductionAmount] = useState('');
    const [deductionReason, setDeductionReason] = useState('');
    const [baseSalary, setBaseSalary] = useState(null);
    const [existingDeductions, setExistingDeductions] = useState(0);
    const [currentNetSalary, setCurrentNetSalary] = useState(null);
    const [payrollLoading, setPayrollLoading] = useState(false);
    const [payrollError, setPayrollError] = useState('');

    useEffect(() => {
        if (currentUser?._id) {
            dispatch(getSchoolLeaves(currentUser._id));
        }
    }, [dispatch, currentUser]);

    const leavesList = useMemo(() => Array.isArray(leaves) ? leaves : [], [leaves]);

    const fetchPayrollInfo = async (leave) => {
        if (!leave || !currentUser?._id) {
            setBaseSalary(null);
            setExistingDeductions(0);
            setCurrentNetSalary(null);
            setPayrollError('');
            return;
        }

        const teacherId = leave.teacher?._id || leave.teacher;
        const monthKey = leave.fromDate ? new Date(leave.fromDate).toISOString().slice(0, 7) : null;

        if (!teacherId || !monthKey) {
            setBaseSalary(null);
            setExistingDeductions(0);
            setCurrentNetSalary(null);
            setPayrollError('');
            return;
        }

        setPayrollLoading(true);
        setPayrollError('');
        try {
            const response = await axios.get(`${BASE_URL}/Payroll/Employee`, {
                params: {
                    employeeId: teacherId,
                    employeeType: 'Teacher',
                    month: monthKey,
                    schoolId: currentUser._id,
                },
            });
            const payroll = response.data?.payroll;
            let net = null;
            let deductions = 0;
            let base = null;

            if (payroll) {
                net = Number(payroll.amount ?? 0);
                deductions = Math.max(0, Number(payroll.deductions || 0));
                base = payroll.baseAmount;
                if (base === undefined || base === null) {
                    base = net + deductions;
                }
            }

            if (base === null || base <= 0) {
                const historyResponse = await axios.get(`${BASE_URL}/Payroll/Employee/Teacher/${teacherId}`);
                const history = Array.isArray(historyResponse.data) ? historyResponse.data : [];
                const sortedHistory = history
                    .filter(record => record)
                    .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
                const latestRecord = sortedHistory.find(record => {
                    const recBase = record?.baseAmount ?? (Number(record?.amount || 0) + Number(record?.deductions || 0));
                    return recBase > 0;
                });
                if (latestRecord) {
                    const historyNet = Number(latestRecord.amount || 0);
                    const historyDeductions = Math.max(0, Number(latestRecord.deductions || 0));
                    const historyBase = latestRecord.baseAmount ?? (historyNet + historyDeductions);
                    if (historyBase > 0) {
                        base = historyBase;
                        if (net === null || net <= 0) {
                            net = historyNet > 0 ? historyNet : historyBase;
                        }
                        if (!payroll) {
                            deductions = historyDeductions;
                        }
                    }
                }
            }

            if ((base === null || base <= 0) && (leave.finalAmount !== undefined && leave.finalAmount !== null)) {
                const lastNet = Number(leave.finalAmount || 0);
                const lastDeduction = Math.max(0, Number(leave.deductionAmount || 0));
                const computedBase = lastNet + lastDeduction;
                if (computedBase > 0) {
                    base = computedBase;
                    if (net === null || net <= 0) {
                        net = lastNet;
                    }
                    if (deductions <= 0 && lastDeduction > 0) {
                        deductions = lastDeduction;
                    }
                }
            }

            setBaseSalary(base !== null && base !== undefined ? Number(base) : null);
            setExistingDeductions(Math.max(0, deductions));
            setCurrentNetSalary(net !== null && net !== undefined ? Math.max(0, Number(net)) : null);
        } catch (error) {
            console.error('Failed to load payroll details', error);
            setBaseSalary(null);
            setExistingDeductions(0);
            setCurrentNetSalary(null);
            setPayrollError('Unable to fetch payroll details. Net salary preview may be inaccurate.');
        } finally {
            setPayrollLoading(false);
        }
    };

    const handleReject = async (leave) => {
        if (!currentUser?._id) return;
        await dispatch(setLeaveStatus(leave._id, { status: 'Rejected', approvedBy: currentUser._id }));
        dispatch(getSchoolLeaves(currentUser._id));
    };

    const previousLeaveDeduction = useMemo(() => {
        if (!selectedLeave || !selectedLeave.deductionApplied) return 0;
        return Number(selectedLeave.deductionAmount || 0);
    }, [selectedLeave]);

    const deductionsExcludingCurrent = useMemo(() => {
        return Math.max(0, Number(existingDeductions || 0) - previousLeaveDeduction);
    }, [existingDeductions, previousLeaveDeduction]);

    const currentDeductionValue = deductionApplied ? Math.max(0, Number(deductionAmount || 0)) : 0;

    const totalProjectedDeductions = useMemo(() => {
        return Math.max(0, deductionsExcludingCurrent + currentDeductionValue);
    }, [deductionsExcludingCurrent, currentDeductionValue]);

    const previewSalary = useMemo(() => {
        if (baseSalary === null || baseSalary === undefined) return null;
        const base = Number(baseSalary) || 0;
        const net = base - totalProjectedDeductions;
        return net >= 0 ? net : 0;
    }, [baseSalary, totalProjectedDeductions]);

    const openApproveDialog = (leave) => {
        setSelectedLeave(leave);
        setDeductionApplied(Boolean(leave.deductionApplied));
        setDeductionAmount(
            leave.deductionAmount !== undefined && leave.deductionAmount !== null
                ? String(leave.deductionAmount)
                : ''
        );
        setDeductionReason(leave.deductionReason || '');
        setBaseSalary(null);
        setExistingDeductions(0);
        setPayrollError('');
        fetchPayrollInfo(leave);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setSelectedLeave(null);
        setDeductionApplied(false);
        setDeductionAmount('');
        setDeductionReason('');
        setBaseSalary(null);
        setExistingDeductions(0);
        setCurrentNetSalary(null);
        setPayrollLoading(false);
        setPayrollError('');
    };

    const handleApprove = async () => {
        if (!selectedLeave || !currentUser?._id) return;
        const payload = {
            status: 'Approved',
            approvedBy: currentUser._id,
            deductionApplied,
        };

        if (deductionApplied) {
            const normalizedDeduction = deductionAmount ? Math.max(0, Number(deductionAmount)) : 0;
            payload.deductionAmount = normalizedDeduction;
            payload.deductionReason = deductionReason || `Leave deduction (${calculateDays(selectedLeave.fromDate, selectedLeave.toDate)} days)`;
        }

        await dispatch(setLeaveStatus(selectedLeave._id, payload));
        closeDialog();
        dispatch(getSchoolLeaves(currentUser._id));
    };

    return (
    <AdminPageShell
      title="Teacher Leave"
      subtitle="Approve and track teacher leave requests."
      breadcrumbs={[
        { label: "Admin", href: "/" },
        { label: "Communicate", href: "/Admin/teacher-leave" },
        { label: "Teacher Leave" }
      ]}
      action={null}
    >
            <Stack spacing={2}>
                {loading && leavesList.length === 0 && (
                    <Typography variant="body2">Loading leaves...</Typography>
                )}
                {leavesList.map(leave => {
                    const totalDays = leave.totalDays || calculateDays(leave.fromDate, leave.toDate);
                    return (
                        <Card key={leave._id}>
                            <CardContent>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            {leave.teacher?.name || 'Unknown Teacher'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Days: {totalDays}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={5}>
                                        <Typography variant="body2">
                                            {leave.reason}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                                        </Typography>
                                        {leave.deductionApplied && (
                                            <Typography variant="caption" color="error">
                                                Deduction applied: Rs.{leave.deductionAmount || 0} {leave.deductionReason ? `(${leave.deductionReason})` : ''}
                                            </Typography>
                                        )}
                                        {leave.finalAmount !== undefined && leave.finalAmount !== null && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Net salary after deductions: ₹{Number(leave.finalAmount).toLocaleString()}
                                            </Typography>
                                        )}
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <Chip label={leave.status} color={statusColor(leave.status)} size="small" />
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <Stack direction="row" spacing={1}>
                                            <Button size="small" variant="contained" onClick={() => openApproveDialog(leave)}>
                                                Approve
                                            </Button>
                                            <Button size="small" variant="outlined" color="error" onClick={() => handleReject(leave)}>
                                                Reject
                                            </Button>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    );
                })}
                {!loading && leavesList.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        No leave applications found.
                    </Typography>
                )}
            </Stack>

            <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Approve Leave &amp; Salary Adjustment</DialogTitle>
                <DialogContent dividers>
                    {selectedLeave && (
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {selectedLeave.teacher?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {formatDate(selectedLeave.fromDate)} - {formatDate(selectedLeave.toDate)} ({selectedLeave.totalDays || calculateDays(selectedLeave.fromDate, selectedLeave.toDate)} days)
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={deductionApplied}
                                        onChange={(e) => setDeductionApplied(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Apply salary deduction for this leave"
                            />
                            {deductionApplied && (
                                <TextField
                                    margin="dense"
                                    label="Deduction Amount (Rs.)"
                                    type="number"
                                    fullWidth
                                    value={deductionAmount}
                                    onChange={(e) => setDeductionAmount(e.target.value)}
                                    helperText="Total amount to deduct from the teacher's salary for this month"
                                    inputProps={{ min: 0 }}
                                />
                            )}
                            {deductionApplied && (
                                <TextField
                                    margin="dense"
                                    label="Deduction Notes"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={deductionReason}
                                    onChange={(e) => setDeductionReason(e.target.value)}
                                    helperText="Reason for deduction (visible in payroll records)"
                                />
                            )}

                            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {payrollLoading ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Loading payroll details...
                                    </Typography>
                                ) : (
                                    <>
                                        <Typography variant="body2">
                                            <strong>Base salary:</strong>{' '}
                                            {baseSalary === null || baseSalary === undefined
                                                ? 'Not set'
                                                : `₹${Number(baseSalary).toLocaleString()}`}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Current payroll net salary:</strong>{' '}
                                            {currentNetSalary === null || currentNetSalary === undefined
                                                ? 'Not set'
                                                : `₹${Number(currentNetSalary).toLocaleString()}`}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Other deductions this month:</strong>{' '}
                                            ₹{deductionsExcludingCurrent.toLocaleString()}
                                        </Typography>
                                        {deductionApplied && (
                                            <Typography variant="body2">
                                                <strong>This leave deduction:</strong>{' '}
                                                ₹{currentDeductionValue.toLocaleString()}
                                            </Typography>
                                        )}
                                        <Typography variant="h6" sx={{ mt: 1 }}>
                                            Net salary after deduction:{' '}
                                            {previewSalary !== null ? `₹${previewSalary.toLocaleString()}` : 'Not available'}
                                        </Typography>
                                    </>
                                )}
                                {payrollError && (
                                    <Typography variant="caption" color="error">
                                        {payrollError}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button onClick={handleApprove} variant="contained" disabled={payrollLoading}>
                        Approve &amp; Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminPageShell>
    );
};

export default TeacherLeavePage;