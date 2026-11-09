import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getAllSclasses } from '../../../redux/sclassRelated/sclassHandle';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Typography, Box, CircularProgress } from '@mui/material';
import { StyledTableCell, StyledTableRow } from '../../../components/styles';
import { PrimaryButton } from '../../../components/buttonStyles';

const ShowParents = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser } = useSelector(state => state.user);
    const { sclassesList, loading } = useSelector(state => state.sclass);

    useEffect(() => {
        if (currentUser?._id) {
            dispatch(getAllSclasses(currentUser._id, 'Sclass'));
        }
    }, [dispatch, currentUser]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 0, sm: 1 } }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        Parents Management
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, color: 'text.secondary' }}>
                        Create a parent login, or open a class to see existing accounts
                    </Typography>
                </Box>
                <PrimaryButton onClick={() => navigate('/Admin/addparent')}>
                    Create parent account
                </PrimaryButton>
            </Box>
            
            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Class Name</StyledTableCell>
                                <StyledTableCell align="right">Actions</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        <TableBody>
                            {sclassesList.length > 0 ? (
                                sclassesList.map((sclass) => (
                                    <StyledTableRow key={sclass._id}>
                                        <TableCell>{sclass.sclassName}</TableCell>
                                        <TableCell align="right">
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={() => navigate(`/Admin/parents/class/${sclass._id}`)}
                                            >
                                                View Parents
                                            </Button>
                                        </TableCell>
                                    </StyledTableRow>
                                ))
                            ) : (
                                <StyledTableRow>
                                    <TableCell colSpan={2} align="center">
                                        <Typography variant="body2" color="text.secondary">
                                            No classes found. Please add classes first.
                                        </Typography>
                                    </TableCell>
                                </StyledTableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default ShowParents;
