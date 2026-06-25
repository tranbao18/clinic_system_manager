"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CalendarLayout from "@/components/layout/CalendarLayout";
import { getPatients } from "@/lib/services/patientsService";
import { getAuthHeaderClient } from "@/lib/authHeaderClient";

type Appointment = {
    id: string;
    doctor_id?: string;
    patient_id?: string;
    doctorName: string;
    patientName: string;
    appointmentDate: string;
    status: string;
    reason: string;
    createdAt: string;
};

type Doctor = {
    _id: string;
    fullname: string;
    position: string;
};

type Patient = {
    _id: string;
    fullname: string;
};

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [userEmployeeId, setUserEmployeeId] = useState<string | null>(null);
    const [canManage, setCanManage] = useState<boolean>(false);
    const router = useRouter();
    const normalizeId = (val: any): string | null => {
        if (val === undefined || val === null) return null;
        if (typeof val === "string") return val;
        if (typeof val === "object") {
            if (val._id) return String(val._id);
            if (val.toString) return String(val.toString());
        }
        return String(val);
    };
    const resolvePatientNameFromAppointment = (appt: any, patientsList: Patient[]) => {
        if (!appt || appt.patient_id === undefined || appt.patient_id === null) return "Không rõ";
        const pid = appt.patient_id;
        if (typeof pid === "object") {
            if (pid.fullname) return pid.fullname;
            const idFromObj = pid._id ? String(pid._id) : (pid.toString ? String(pid.toString()) : null);
            if (idFromObj) {
                const found = patientsList.find((p) => String(p._id) === idFromObj);
                if (found) return found.fullname;
            }
            return "Không rõ";
        }
        const found = patientsList.find((p) => String(p._id) === String(pid));
        return found ? found.fullname : "Không rõ";
    };

    // TỰ VIẾT - Combined useEffect
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // First fetch user info from sessionStorage to maintain per-tab sessions
                const userDataStr = sessionStorage.getItem("user") || localStorage.getItem("user");
                if (userDataStr) {
                    const userData = JSON.parse(userDataStr);
                    const role = userData.role || "";
                    const employeeId = userData.employee_id || null;

                    console.log("DEBUG: Fetched user info - role:", role, "employeeId:", employeeId);

                    setUserRole(role);
                    setUserEmployeeId(employeeId);
                    setCanManage(role === "Admin" || role === "Receptionist");

                    // Redirect pharmacist về trang phù hợp nếu truy cập trực tiếp URL
                    if (role === "pharmacist") {
                        router.push("/dashboard/medicines");
                        return;
                    }

                    // Now fetch appointments data if user has permission
                    if (role !== "pharmacist") {
                        console.log("DEBUG: Fetching appointments data for role:", role);

                        let doctorsList: Doctor[] = [];
                        let allEmployeesData: any[] = [];
                        const authHeaders = getAuthHeaderClient();
                        const employeesRes = await fetch("/api/employees", { cache: "no-store", headers: authHeaders });
                        if (employeesRes.ok) {
                            const employeesData = await employeesRes.json();
                            allEmployeesData = Array.isArray(employeesData) ? employeesData : [];
                            doctorsList = allEmployeesData
                                .filter((emp: any) => emp.position === "Bác sĩ")
                                .map((emp: any) => ({
                                    _id: String(emp._id),
                                    fullname: emp.fullname,
                                    position: emp.position,
                                }));
                            setDoctors(doctorsList);
                        }

                        let mappedPatients: Patient[] = [];
                        try {
                            const patientsList = await getPatients();
                            mappedPatients = patientsList.map((p: any) => ({
                                _id: String(p._id),
                                fullname: p.fullname,
                            }));
                            setPatients(mappedPatients);
                        } catch (error) {
                            console.error("Error fetching patients:", error);
                        }

                        // Fetch appointments if user has permission
                        if (role === "Admin" || role === "Receptionist" || role === "Doctor" || role === "Accountant") {
                            console.log("DEBUG: Fetching appointments API for role:", role);
                            const appointmentsRes = await fetch("/api/appointments", { cache: "no-store", headers: authHeaders });
                            if (appointmentsRes.ok) {
                                const appointmentsData = await appointmentsRes.json();
                                console.log("DEBUG: Received appointments data:", appointmentsData.length, "items");

                                const mapApiToUiStatus = (s: string) => {
                                    if (s === "warning") return "Scheduled";
                                    if (s === "success") return "Completed";
                                    if (s === "error") return "Cancelled";
                                    if (s === "Scheduled" || s === "Completed" || s === "Cancelled") return s;
                                    return s;
                                };

                                const findDoctor = (doctorId: string | null): Doctor | null => {
                                    if (!doctorId) return null;
                                    const normalizedDoctorId = String(doctorId);

                                    let doctor = doctorsList.find((d: Doctor) => {
                                        return String(d._id) === normalizedDoctorId;
                                    });

                                    if (!doctor) {
                                        const employee = allEmployeesData.find((emp: any) => {
                                            return String(emp._id) === normalizedDoctorId;
                                        });

                                        if (employee) {
                                            doctor = {
                                                _id: String(employee._id),
                                                fullname: employee.fullname,
                                                position: employee.position || "",
                                            };
                                            if (employee.position === "Bác sĩ") {
                                                doctorsList.push(doctor);
                                            }
                                        }
                                    }

                                    return doctor || null;
                                };

                                let mappedAppointments = appointmentsData.map((a: {
                                    _id: string;
                                    doctor_id?: string;
                                    patient_id?: string;
                                    appointment_date: string;
                                    status: string;
                                    reason?: string;
                                    created_at?: string;
                                }) => {
                                    const appointmentDoctorId = normalizeId(a.doctor_id);
                                    const appointmentPatientId = normalizeId(a.patient_id);

                                    const doctor = findDoctor(appointmentDoctorId);
                                    const patientName = resolvePatientNameFromAppointment(a, mappedPatients);

                                    return {
                                        id: a._id,
                                        doctor_id: appointmentDoctorId || undefined,
                                        patient_id: appointmentPatientId || undefined,
                                        doctorName: doctor ? doctor.fullname : "Không rõ",
                                        patientName: patientName,
                                        appointmentDate: a.appointment_date,
                                        status: mapApiToUiStatus(a.status),
                                        reason: a.reason,
                                        createdAt: a.created_at,
                                    };
                                });

                                const currentCanManage = role === "Admin" || role === "Receptionist";
                                if (!currentCanManage) {
                                    console.log("DEBUG: Filtering appointments for non-admin user, employeeId =", employeeId);
                                    if (employeeId) {
                                        const normalizedUserEmployeeId = String(employeeId);
                                        mappedAppointments = mappedAppointments.filter((a: Appointment) => {
                                            const appointmentDoctorId = normalizeId(a.doctor_id);
                                            return appointmentDoctorId === normalizedUserEmployeeId;
                                        });
                                        console.log("DEBUG: Filtered appointments count =", mappedAppointments.length);
                                    } else {
                                        console.log("DEBUG: No employeeId, setting appointments to empty");
                                        mappedAppointments = [];
                                    }
                                } else {
                                    console.log("DEBUG: Admin/Receptionist user, showing all appointments, count =", mappedAppointments.length);
                                }

                                setAppointments(mappedAppointments);
                            } else {
                                console.error("DEBUG: Failed to fetch appointments, status:", appointmentsRes.status);
                            }
                        } else {
                            console.log("DEBUG: User role", role, "not allowed to view appointments");
                        }
                    }
                } else {
                    console.error("DEBUG: Failed to fetch user info from localStorage");
                }
            } catch (error) {
                console.error("Error in fetchAllData:", error);
            }
        };

        fetchAllData();
    }, [router]);

    const handleRefresh = useCallback(async () => {
        try {
            const authHeaders = getAuthHeaderClient();
            const [appointmentsRes, employeesRes, patientsRes] = await Promise.all([
                fetch("/api/appointments", { cache: "no-store", headers: authHeaders }),
                fetch("/api/employees", { cache: "no-store", headers: authHeaders }),
                getPatients(),
            ]);

            if (!appointmentsRes.ok) throw new Error("Failed to refresh appointments");

            const appointmentsData = await appointmentsRes.json();

            let employeesData: any[] = [];
            if (employeesRes.ok) {
                employeesData = await employeesRes.json();
                const doctorsList = Array.isArray(employeesData)
                    ? employeesData
                        .filter((emp: any) => emp.position === "Bác sĩ")
                        .map((emp: any) => ({
                            _id: String(emp._id),
                            fullname: emp.fullname,
                            position: emp.position,
                        }))
                    : [];
                setDoctors(doctorsList);
            }

            const mappedPatients = patientsRes.map((p: any) => ({
                _id: String(p._id),
                fullname: p.fullname,
            }));
            setPatients(mappedPatients);

            const mapApiToUiStatus = (s: string) => {
                if (s === "warning") return "Scheduled";
                if (s === "success") return "Completed";
                if (s === "error") return "Cancelled";
                return s;
            };

            const findDoctorInRefresh = (doctorId: string | null): Doctor | null => {
                if (!doctorId) return null;
                const normalizedDoctorId = String(doctorId);

                const currentDoctors = Array.isArray(employeesData)
                    ? employeesData
                        .filter((emp: any) => emp.position === "Bác sĩ")
                        .map((emp: any) => ({
                            _id: String(emp._id),
                            fullname: emp.fullname,
                            position: emp.position,
                        }))
                    : doctors.map(d => ({ ...d, _id: String(d._id) }));

                let doctor = currentDoctors.find((d: Doctor) => {
                    return String(d._id) === normalizedDoctorId;
                });

                if (!doctor) {
                    const employee = employeesData.find((emp: any) => {
                        return String(emp._id) === normalizedDoctorId;
                    });

                    if (employee) {
                        doctor = {
                            _id: String(employee._id),
                            fullname: employee.fullname,
                            position: employee.position || "",
                        };
                    }
                }

                return doctor || null;
            };

            let mappedAppointments = appointmentsData.map((a: {
                _id: string;
                doctor_id?: string;
                patient_id?: string;
                appointment_date: string;
                status: string;
                reason?: string;
                created_at?: string;
            }) => {
                const appointmentDoctorId = normalizeId(a.doctor_id);
                const appointmentPatientId = normalizeId(a.patient_id);

                const doctor = findDoctorInRefresh(appointmentDoctorId);
                const patientName = resolvePatientNameFromAppointment(a, mappedPatients);

                return {
                    id: a._id,
                    doctor_id: appointmentDoctorId || undefined,
                    patient_id: appointmentPatientId || undefined,
                    doctorName: doctor ? doctor.fullname : "Không rõ",
                    patientName: patientName,
                    appointmentDate: a.appointment_date,
                    status: mapApiToUiStatus(a.status),
                    reason: a.reason,
                    createdAt: a.created_at,
                };
            });

            const currentCanManage = userRole === "Admin" || userRole === "Receptionist";
            if (!currentCanManage) {
                if (userEmployeeId) {
                    const normalizedUserEmployeeId = String(userEmployeeId);
                    mappedAppointments = mappedAppointments.filter((a: Appointment) => {
                        const appointmentDoctorId = normalizeId(a.doctor_id);
                        return appointmentDoctorId === normalizedUserEmployeeId;
                    });
                } else {
                    mappedAppointments = [];
                }
            }

            setAppointments(mappedAppointments);
        } catch (error) {
            console.error("Refresh error:", error);
            window.location.reload();
        }
    }, [userRole, doctors, userEmployeeId]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        if (!token) return;

        const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
        es.onmessage = (e) => {
            try {
                const notif = JSON.parse(e.data);
                if (notif && notif.related_type === "appointment") {
                    handleRefresh();
                }
            } catch (err) {
                console.error("SSE parse error:", err);
            }
        };
        es.onerror = (err) => {
            console.warn("SSE error:", err);
        };

        return () => {
            es.close();
        };
    }, [userRole, userEmployeeId, handleRefresh]);



    return (
        <div>
            <div className="p-6 pb-0 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Lịch hẹn</h1>
            </div>
            <CalendarLayout
                appointments={appointments}
                doctors={doctors}
                patients={patients}
                onRefresh={handleRefresh}
                canManage={canManage}
            />
        </div>
    );
}

