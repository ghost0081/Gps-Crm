import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getAllStudents } from '../../../redux/studentRelated/studentHandle';
import { deleteUser } from '../../../redux/userRelated/userHandle';
import {
  Box, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Typography, Button, Tooltip,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import GradeIcon from '@mui/icons-material/Grade';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import * as React from 'react';
import axios from 'axios';
import { PrimaryButton, DangerButton, GhostButton, SuccessButton } from '../../../components/buttonStyles';
import TableTemplate from '../../../components/TableTemplate';
import SpeedDialTemplate from '../../../components/SpeedDialTemplate';
import Popup from '../../../components/Popup';
import AdminPageShell from '../../../components/admin/AdminPageShell';

/*
 * ShowStudents — the student list page
 *
 * IMPROVEMENTS:
 * 1. TableTemplate now provides built-in search and sort — no changes needed here
 * 2. BLE Allotment moved to an icon-button action (less clutter in the action row)
 * 3. Split-button replaced with individual icon buttons + tooltips (Fitts's Law:
 *    discrete targets are faster to hit than split buttons with dropdowns)
 * 4. Loading state uses proper skeleton via TableTemplate's `loading` prop
 * 5. Delete is disabled (as before) with a clearer explanation
 */

const ShowStudents = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { studentsList, loading, error, response } = useSelector(state => state.student);
  const { currentUser } = useSelector(state => state.user);

  useEffect(() => {
    dispatch(getAllStudents(currentUser._id));
  }, [currentUser._id, dispatch]);

  if (error) console.log(error);

  const [showPopup, setShowPopup]     = React.useState(false);
  const [message, setMessage]         = React.useState('');
  const [popupSeverity, setPopupSeverity] = React.useState('error');
  const [allotStudent, setAllotStudent] = React.useState(null);
  const [allotImei, setAllotImei]     = React.useState('');

  const deleteHandler = () => {
    setMessage('Delete is disabled for data safety. Contact system administrator.');
    setPopupSeverity('error');
    setShowPopup(true);
  };

  const studentColumns = [
    { id: 'name',       label: 'Name',        minWidth: 170 },
    { id: 'rollNum',    label: 'Roll No.',     minWidth: 80  },
    { id: 'sclassName', label: 'Class',        minWidth: 120 },
    { id: 'imeiDisplay',label: 'BLE Device',   minWidth: 140 },
  ];

  const studentRows = studentsList?.length > 0
    ? studentsList.map(student => ({
        name:        student.name,
        rollNum:     student.rollNum,
        sclassName:  student.sclassName.sclassName,
        imeiDisplay: student.imei ? student.imei : 'Not assigned',
        rawImei:     student.imei || '',
        id:          student._id,
      }))
    : [];

  // ── Per-row action buttons ──────────────────────────────────────────────
  const StudentButtonHaver = ({ row }) => (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {/* View student profile */}
      <Tooltip title="View profile">
        <IconButton
          size="small"
          onClick={() => navigate(`/Admin/students/student/${row.id}`)}
          aria-label={`View ${row.name}'s profile`}
          sx={{ color: 'primary.main', '&:hover': { bgcolor: '#EDE9FE' } }}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Take attendance */}
      <Tooltip title="Take attendance">
        <IconButton
          size="small"
          onClick={() => navigate(`/Admin/students/student/attendance/${row.id}`)}
          aria-label={`Take attendance for ${row.name}`}
          sx={{ color: 'success.main', '&:hover': { bgcolor: '#D1FAE5' } }}
        >
          <HowToRegIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Enter marks */}
      <Tooltip title="Enter marks">
        <IconButton
          size="small"
          onClick={() => navigate(`/Admin/students/student/marks/${row.id}`)}
          aria-label={`Enter marks for ${row.name}`}
          sx={{ color: 'warning.main', '&:hover': { bgcolor: '#FEF3C7' } }}
        >
          <GradeIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Assign BLE device */}
      <Tooltip title={row.rawImei ? `BLE: ${row.rawImei}` : 'Assign BLE device'}>
        <IconButton
          size="small"
          onClick={() => { setAllotStudent(row); setAllotImei(row.rawImei || ''); }}
          aria-label={`Assign BLE device to ${row.name}`}
          sx={{
            color: row.rawImei ? 'primary.main' : 'text.disabled',
            '&:hover': { bgcolor: '#EDE9FE' },
          }}
        >
          <BluetoothIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Delete — disabled with explanation */}
      <Tooltip title="Delete disabled for data safety">
        <span>
          <IconButton
            size="small"
            disabled
            aria-label={`Delete ${row.name} (disabled)`}
          >
            <PersonRemoveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  const speedDialActions = [
    {
      icon: <PersonAddAlt1Icon color="primary" />,
      name: 'Add New Student',
      action: () => navigate('/Admin/addstudents'),
    },
  ];

  return (
    <AdminPageShell
      title="Students"
      subtitle="Manage enrolment, attendance, marks, and wearable device assignments."
      breadcrumbs={[
        { label: 'Admin', href: '/' },
        { label: 'People', href: '/Admin/students' },
        { label: 'Students' },
      ]}
      action={
        <PrimaryButton variant="contained" onClick={() => navigate('/Admin/addstudents')} startIcon={<PersonAddAlt1Icon />}>
          Add Student
        </PrimaryButton>
      }
    >
      {response ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h3" sx={{ color: 'text.secondary', mb: 2 }}>No students yet</Typography>
          <PrimaryButton variant="contained" onClick={() => navigate('/Admin/addstudents')}>
            Add First Student
          </PrimaryButton>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <TableTemplate
            buttonHaver={StudentButtonHaver}
            columns={studentColumns}
            rows={studentRows}
            loading={loading}
            onAdd={() => navigate('/Admin/addstudents')}
            addLabel="+ Add Student"
          />
          <SpeedDialTemplate actions={speedDialActions} />
        </Box>
      )}

      <Dialog
        open={Boolean(allotStudent)}
        onClose={() => setAllotStudent(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BluetoothIcon sx={{ color: 'primary.main' }} />
            Assign BLE / Wearable Device
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Assigning to
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                {allotStudent?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Roll #{allotStudent?.rollNum} · {allotStudent?.sclassName}
              </Typography>
            </Box>

            <TextField
              label="IMEI / BLE Device ID"
              fullWidth
              value={allotImei}
              onChange={(e) => setAllotImei(e.target.value)}
              placeholder="e.g. 864163085084979"
              helperText="Enter the hardware IMEI or BLE identifier. Leave empty to remove the current assignment."
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <GhostButton onClick={() => setAllotStudent(null)}>Cancel</GhostButton>
          <PrimaryButton
            variant="contained"
            onClick={async () => {
              try {
                await axios.put(`${process.env.REACT_APP_BASE_URL}/Student/${allotStudent.id}`, { imei: allotImei });
                setAllotStudent(null);
                dispatch(getAllStudents(currentUser._id));
                setMessage('BLE device assigned successfully!');
                setPopupSeverity('success');
                setShowPopup(true);
              } catch (err) {
                console.error(err);
                setMessage('Failed to assign BLE device. Please try again.');
                setPopupSeverity('error');
                setShowPopup(true);
              }
            }}
          >
            Save Assignment
          </PrimaryButton>
        </DialogActions>
      </Dialog>

      <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} severity={popupSeverity} />
    </AdminPageShell>
  );
};

export default ShowStudents;