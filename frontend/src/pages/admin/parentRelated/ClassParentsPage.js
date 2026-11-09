import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { getParents } from '../../../redux/parentRelated/parentHandle';
import { getAllSclasses } from '../../../redux/sclassRelated/sclassHandle';
import { Paper, Box, Typography, Alert, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import { StyledTableCell, StyledTableRow } from '../../../components/styles';
import Popup from '../../../components/Popup';

const ClassParentsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { id } = useParams(); // classId
    const { parentsList, loading, error, response, status } = useSelector((state) => state.parent);
    const { currentUser } = useSelector((state) => state.user);
    const { sclassesList } = useSelector((state) => state.sclass);
    
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState("");

    // Get class name
    const currentClass = sclassesList.find(sclass => sclass._id === id);

    useEffect(() => {
        if (currentUser?._id) {
            dispatch(getParents(currentUser._id));
            dispatch(getAllSclasses(currentUser._id, 'Sclass'));
        }
    }, [dispatch, currentUser]);

    useEffect(() => {
        if (status === 'error') {
            const errorMessage = error?.response?.data?.message || error?.message || "Network Error. Please check your connection and try again.";
            setMessage(errorMessage);
            setShowPopup(true);
            console.error("Error fetching parents:", error);
        } else if (status === 'failed') {
            setMessage(response || "Failed to load parents");
            setShowPopup(true);
        }
    }, [status, error, response]);

    // Filter parents by class
    const classParents = parentsList.filter(parent => {
        const studentClassId = parent.student?.sclassName?._id || parent.student?.sclassName;
        return studentClassId === id;
    });

    if (loading && parentsList.length === 0) {
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
                    Parents & Students - {currentClass?.sclassName || 'Class'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" onClick={() => navigate('/Admin/addparent')}>
                        Create parent account
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/Admin/parents')}>
                        Back to Classes
                    </Button>
                </Box>
            </Box>

            {status === 'error' && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load parents. Please refresh the page or check your connection.
                </Alert>
            )}

            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Parent Name</StyledTableCell>
                                <StyledTableCell>Student Name</StyledTableCell>
                                <StyledTableCell>Roll Number</StyledTableCell>
                                <StyledTableCell>Mobile Number</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        <TableBody>
                            {classParents.length > 0 ? (
                                classParents.map((parent) => (
                                    <StyledTableRow key={parent._id}>
                                        <TableCell>{parent.name}</TableCell>
                                        <TableCell>{parent.student?.name || 'N/A'}</TableCell>
                                        <TableCell>{parent.student?.rollNum || 'N/A'}</TableCell>
                                        <TableCell>{parent.mobile || 'N/A'}</TableCell>
                                    </StyledTableRow>
                                ))
                            ) : (
                                <StyledTableRow>
                                    <TableCell colSpan={4} align="center">
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                            {loading ? 'Loading...' : 'No parents found for this class. Add students with parent details to see them here.'}
                                        </Typography>
                                    </TableCell>
                                </StyledTableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </Box>
    );
};

export default ClassParentsPage;

