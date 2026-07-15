// KẾ THỪA
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateAppointment,
  deleteAppointment,
  createAppointment,
  type UpdateAppointmentData,
  type CreateAppointmentData,
} from "@/lib/services/appointmentsService";

type Appointment = {
  id: string;
  _id?: string;
  doctor_id?: string;
  patient_id?: string;
  doctorName: string;
  patientName: string;
  appointmentDate: string; // ISO
  status: "Scheduled" | "Cancelled" | "Pending" | "Completed" | string;
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

type CalendarLayoutProps = {

  appointments?: Appointment[];
  doctors?: Array<{ _id: string; fullname: string }>;
  patients?: Array<{ _id: string; fullname: string }>;
  onRefresh?: () => Promise<void>;
  canManage?: boolean;
};

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < (firstDay.getDay() + 6) % 7; i++) currentWeek.push(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

export default function CalendarLayout({

  appointments = [],
  doctors = [],
  patients = [],
  onRefresh,
  canManage = false,
}: CalendarLayoutProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return new Date().getMonth();
    }
    return 0; // Default value for SSR
  });
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return new Date().getFullYear();
    }
    return 2024; // Default value for SSR
  });

  const [today, setToday] = useState<Date>(() => {
    if (typeof window !== 'undefined') {
      return new Date();
    }
    return new Date(2024, 0, 1); // Default value for SSR
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setToday(now);
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAppointments, setSelectedAppointments] = useState<
    Appointment[]
  >([]);
  const [open, setOpen] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictItems, setConflictItems] = useState<Appointment[]>([]);
  const pendingCreateRef = useRef<CreateAppointmentData | null>(null);
  const [showOldAppointments, setShowOldAppointments] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<string>("");
  const [formData, setFormData] = useState<UpdateAppointmentData>({
    patient_id: "",
    doctor_id: "",
    appointment_date: "",
    status: "",
    reason: "",
  });

  const weeks = generateCalendar(currentYear, currentMonth);


  const getAppointmentByDate = (date: Date) => {
    if (!appointments || !Array.isArray(appointments)) return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    let filteredAppointments = appointments.filter((a) => {
      if (!a.appointmentDate) return false;
      const apptDate = getLocalDateOnlyString(a.appointmentDate);
      return apptDate === dateStr;
    });

    if (!showOldAppointments) {
      const todayStr = getLocalDateOnlyString(today.toISOString());
      filteredAppointments = filteredAppointments.filter((a) => {
        if (!a.appointmentDate) return false;
        const apptDate = getLocalDateOnlyString(a.appointmentDate);
        return apptDate >= todayStr;
      });
    }

    return filteredAppointments;
  };

  const handleClickDate = (date: Date) => {
    const appts = getAppointmentByDate(date);
    if (appts.length > 0) {
      setSelectedDate(date);
      setSelectedAppointments(appts);
      setOpen(true);
      setIsEditing(false);
      setEditingAppointment(null);
    }
  };

  const isoToLocalDateTime = (dateString: string): string => {
    if (!dateString) return "";

    let date: Date;
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      date = new Date(year, month - 1, day, 0, 0);
    } else {
      date = new Date(dateString);
    }


    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseToLocalDate = (value: string): Date | null => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0);
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      const [datePart, timePart] = value.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const [hh, mm] = timePart.split(":").map(Number);
      return new Date(y, m - 1, d, hh, mm, 0);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const getLocalDateOnlyString = (value: string): string => {
    const d = parseToLocalDate(value);
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const toLocalDateTimeSeconds = (value: string): string => {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsEditing(true);
    const fullAppointment = appointments.find((a) => a.id === appointment.id);
    setFormData({
      patient_id: appointment.patient_id || "",
      doctor_id: appointment.doctor_id || "",
      appointment_date: appointment.appointmentDate
        ? isoToLocalDateTime(appointment.appointmentDate)
        : "",
      status: appointment.status || "",
      reason: appointment.reason || "",
    });
  };

  const handleSave = async () => {
    if (!editingAppointment) return;

    if (
      !formData.patient_id ||
      !formData.doctor_id ||
      !formData.appointment_date ||
      !formData.status
    ) {
      alert(
        "Vui lòng điền đầy đủ thông tin bắt buộc (Bệnh nhân, Bác sĩ, Ngày giờ, Trạng thái)"
      );
      return;
    }

    try {
      setIsSaving(true);
      const localDateTime = toLocalDateTimeSeconds(formData.appointment_date);

      const updateData: UpdateAppointmentData = {
        ...formData,
        appointment_date: localDateTime,
        status: formData.status || undefined,
      };

      await updateAppointment(editingAppointment.id, updateData);
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
      setIsEditing(false);
      setEditingAppointment(null);
      setOpen(false);
      setFormData({
        patient_id: "",
        doctor_id: "",
        appointment_date: "",
        status: "",
        reason: "",
      });
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      alert(error.message || "Không thể cập nhật lịch hẹn. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (appointmentId: string) => {
    setDeleteAppointmentId(appointmentId);
    setOpenDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteAppointmentId) return;

    try {
      setDeletingId(deleteAppointmentId);
      console.log("🔄 Attempting to delete appointment:", deleteAppointmentId);

      await deleteAppointment(deleteAppointmentId);
      console.log("✅ Successfully deleted appointment:", deleteAppointmentId);

      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
      setOpen(false);
      setOpenDeleteConfirm(false);
      setSelectedAppointments([]);
      setDeleteAppointmentId(null);
    } catch (error: any) {
      console.error("❌ Error deleting appointment:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        response: error.response
      });

      let errorMessage = "Không thể xóa lịch hẹn. Vui lòng thử lại.";
      if (error.message.includes("Completed appointment cannot be deleted")) {
        errorMessage = "Không thể xóa lịch hẹn đã hoàn thành.";
      } else if (error.message.includes("not found")) {
        errorMessage = "Lịch hẹn không tồn tại.";
      } else if (error.message.includes("permission") || error.message.includes("auth")) {
        errorMessage = "Bạn không có quyền xóa lịch hẹn này.";
      }

      alert(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditingAppointment(null);
    setFormData({
      patient_id: "",
      doctor_id: "",
      appointment_date: "",
      status: "",
      reason: "",
    });
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setOpenCreate(true);
    setFormData({
      patient_id: "",
      doctor_id: "",
      appointment_date: "",
      status: "Scheduled",
      reason: "",
    });
  };

  const handleSaveCreate = async () => {
    if (
      !formData.patient_id ||
      !formData.doctor_id ||
      !formData.appointment_date ||
      !formData.status
    ) {
      alert(
        "Vui lòng điền đầy đủ thông tin bắt buộc (Bệnh nhân, Bác sĩ, Ngày giờ, Trạng thái)"
      );
      return;
    }

    try {
      setIsSaving(true);
      const localDateTime = toLocalDateTimeSeconds(formData.appointment_date);

      const createData: CreateAppointmentData = {
        patient_id: formData.patient_id,
        doctor_id: formData.doctor_id,
        appointment_date: localDateTime,
        status: formData.status || "Scheduled", // Default là "Scheduled"
        reason: formData.reason || "",
      };
      // Conflict detection: prevent creating if same doctor has an appointment at the exact time
      // or within +/- 30 minutes. Uses local-date parsing to avoid timezone mismatches.
      const newApptDate = parseToLocalDate(createData.appointment_date);
      const normalizeDoctorId = (val: any) => {
        if (val == null) return "";
        if (typeof val === "string") return val;
        if (typeof val === "object") return String(val._id || val.toString());
        return String(val);
      };

      const newDoctorId = normalizeDoctorId(createData.doctor_id);
      // find conflict appointment (exact or within +/- 15 minutes)
      const conflictingAppt = appointments.find((a) => {
        if (!a.appointmentDate) return false;
        if (a.status === "Cancelled") return false;
        const aDoctor = normalizeDoctorId(a.doctor_id);
        if (aDoctor !== newDoctorId) return false;
        const existingDate = parseToLocalDate(a.appointmentDate);
        if (!existingDate || !newApptDate) return false;
        const diffMs = Math.abs(existingDate.getTime() - newApptDate.getTime());
        // same exact time or within 15 minutes => conflict
        if (diffMs === 0 || diffMs <= 15 * 60 * 1000) return true;
        return false;
      });

      if (conflictingAppt) {
        const exDate = parseToLocalDate(conflictingAppt.appointmentDate);
        const exDisplay = exDate
          ? exDate.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
          : conflictingAppt.appointmentDate;
        const docName = conflictingAppt.doctorName || "Bác sĩ";
        const patientName = conflictingAppt.patientName || "Bệnh nhân";
        setConflictInfo(
          `Phát hiện lịch trùng với ${docName} vào ${exDisplay} (bệnh nhân: ${patientName}). Vui lòng chọn thời gian khác.`
        );
        setConflictModalOpen(true);
        setIsSaving(false);
        return;
      }

      await createAppointment(createData);
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
      setIsCreating(false);
      setOpenCreate(false);
      setFormData({
        patient_id: "",
        doctor_id: "",
        appointment_date: "",
        status: "",
        reason: "",
      });
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      alert(error.message || "Không thể tạo lịch hẹn. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const mapUiToApiStatus = (s: string) => {
    if (s === "Scheduled") return "Đã lên lịch";
    if (s === "Completed") return "Hoàn thành";
    if (s === "Cancelled") return "Đã huỷ";
    return s;
  };

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  const yearRange = Array.from(
    { length: 11 },
    (_, i) => today.getFullYear() - 5 + i
  );

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCurrentMonth((prevMonth) => {
                  let newMonth = prevMonth - 1;
                  let newYear = currentYear;

                  if (newMonth < 0) {
                    newMonth = 11;
                    newYear = currentYear - 1;
                  }

                  setCurrentYear(newYear);
                  return newMonth;
                });
              }}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              ←
            </button>

            <CardTitle>
              {monthNames[currentMonth]}, {currentYear}
            </CardTitle>

            <button
              onClick={() => {
                setCurrentMonth((prevMonth) => {
                  let newMonth = prevMonth + 1;
                  let newYear = currentYear;

                  if (newMonth > 11) {
                    newMonth = 0;
                    newYear = currentYear + 1;
                  }

                  setCurrentYear(newYear);
                  return newMonth;
                });
              }}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <Button
                onClick={handleCreateNew}
                className="bg-primary hover:bg-primary/90"
              >
                ➕ Tạo lịch hẹn mới
              </Button>
            )}

            {/* Toggle hiển thị lịch hẹn cũ */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOldAppointments}
                onChange={(e) => setShowOldAppointments(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">
                Hiển thị lịch hẹn cũ
              </span>
            </label>

            {mounted && (
              <div className="flex gap-2">
                <Select
                  value={currentMonth.toString()}
                  onValueChange={(v) => setCurrentMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Chọn tháng" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={currentYear.toString()}
                  onValueChange={(v) => setCurrentYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Chọn năm" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearRange.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center font-semibold">
            {weekdays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 mt-2">
            {weeks.map((week, wi) =>
              week.map((date, di) => {
                if (!date)
                  return (
                    <div
                      key={wi + "-" + di}
                      className="p-4 border rounded bg-muted"
                    ></div>
                  );

                const dayAppointments = getAppointmentByDate(date);

                const isPastDate = !showOldAppointments &&
                  getLocalDateOnlyString(date.toISOString()) < getLocalDateOnlyString(today.toISOString());
                const hasAppointments = dayAppointments.length > 0;
                const isClickable = hasAppointments && (!isPastDate || showOldAppointments);

                return (
                  <div
                    key={wi + "-" + di}
                    onClick={() => isClickable && handleClickDate(date)}
                    className={cn(
                      "p-2 border rounded text-sm min-h-[80px] text-left transition",
                      date.toDateString() === today.toDateString() &&
                      "bg-blue-100 font-bold",
                      isClickable && "cursor-pointer hover:bg-blue-50",
                      !isClickable && "cursor-default opacity-50",
                      isPastDate && !showOldAppointments && "bg-gray-50"
                    )}
                  >
                    <div className="font-medium">{date.getDate()}</div>
                    <div className="space-y-1 mt-1">
                      {dayAppointments.length > 0 ? (
                        dayAppointments.map((a, i) => (
                          <div
                            key={i}
                            className={cn(
                              "p-1 rounded text-xs truncate",
                              a.status === "Scheduled" &&
                              "bg-green-100 text-green-700",
                              a.status === "Pending" &&
                              "bg-yellow-100 text-yellow-700",
                              a.status === "Cancelled" &&
                              "bg-red-100 text-red-700",
                              a.status === "Completed" &&
                              "bg-blue-100 text-blue-700"
                            )}
                          >
                            {a.patientName}
                          </div>
                        ))
                      ) : (
                        <div className="text-muted-foreground text-xs italic">
                          &nbsp;
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* 🩺 Modal chi tiết lịch hẹn - Card Layout */}
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setIsEditing(false);
            setEditingAppointment(null);
            setFormData({
              patient_id: "",
              doctor_id: "",
              appointment_date: "",
              status: "",
              reason: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              📅 Lịch hẹn ngày{" "}
              {selectedDate &&
                selectedDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            </DialogTitle>
            <DialogDescription>
              {selectedAppointments.length} cuộc hẹn trong ngày này
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {isEditing && editingAppointment ? (
              <Card className="p-6 border-2 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    ✏️ Chỉnh sửa lịch hẹn
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    ✕
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Bệnh nhân <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.patient_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, patient_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn bệnh nhân" />
                        </SelectTrigger>
                        <SelectContent>
                          {patients.map((patient) => (
                            <SelectItem key={patient._id} value={patient._id}>
                              {patient.fullname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Bác sĩ <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.doctor_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, doctor_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn bác sĩ" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.map((doctor) => (
                            <SelectItem key={doctor._id} value={doctor._id}>
                              {doctor.fullname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Ngày và giờ hẹn <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="datetime-local"
                        value={formData.appointment_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            appointment_date: e.target.value,
                          })
                        }
                      />
                    </div>


                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Trạng thái <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Scheduled">Đã lên lịch</SelectItem>
                          <SelectItem value="Completed">Hoàn thành</SelectItem>
                          <SelectItem value="Cancelled">Đã huỷ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Lý do khám
                    </label>
                    <Input
                      value={formData.reason || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, reason: e.target.value })
                      }
                      placeholder="Nhập lý do khám"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button variant="outline" onClick={handleCancel}>
                      Hủy
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : selectedAppointments.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Không có lịch hẹn nào trong ngày này
                </p>
              </Card>
            ) : (
              selectedAppointments.map((a) => {
                const time = new Date(a.appointmentDate).toLocaleTimeString(
                  "vi-VN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );
                const statusColors = {
                  Scheduled: "bg-green-100 text-green-800 border-green-300",
                  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
                  Cancelled: "bg-red-100 text-red-800 border-red-300",
                  Completed: "bg-blue-100 text-blue-800 border-blue-300",
                };
                const statusColor =
                  statusColors[a.status as keyof typeof statusColors] ||
                  "bg-gray-100 text-gray-800 border-gray-300";

                return (
                  <Card
                    key={a.id}
                    className="p-5 border-2 hover:shadow-lg transition-all duration-200 hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-bold border-2 uppercase",
                              statusColor
                            )}
                          >
                            {mapUiToApiStatus(a.status)}
                          </span>
                          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <span>🕐</span>
                            <span>{time}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary min-w-[80px]">
                              👨‍⚕️ Bác sĩ:
                            </span>
                            <span className="text-sm text-foreground">
                              {a.doctorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary min-w-[80px]">
                              👤 Bệnh nhân:
                            </span>
                            <span className="text-sm text-foreground">
                              {a.patientName}
                            </span>
                          </div>
                          {a.reason && (
                            <div className="flex items-start gap-2 pt-1">
                              <span className="text-sm font-semibold text-primary min-w-[80px]">
                                📝 Lý do:
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {a.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleEdit(a)}
                            className="min-w-[120px] bg-yellow-500 "
                          >
                            ✏️ Chỉnh sửa
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="min-w-[120px] bg-red-500 "
                          >
                            {deletingId === a.id ? "⏳ Đang xóa..." : "🗑️ Xóa"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ➕ Dialog tạo lịch hẹn mới */}
      <Dialog
        open={openCreate}
        onOpenChange={(isOpen) => {
          setOpenCreate(isOpen);
          if (!isOpen) {
            setIsCreating(false);
            setFormData({
              patient_id: "",
              doctor_id: "",
              appointment_date: "",
              status: "",
              reason: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              ➕ Tạo lịch hẹn mới
            </DialogTitle>
            <DialogDescription>
              Điền thông tin để tạo lịch hẹn mới cho bệnh nhân
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Card className="p-6 border-2 shadow-lg">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bệnh nhân <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.patient_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, patient_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn bệnh nhân" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient._id} value={patient._id}>
                            {patient.fullname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bác sĩ <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.doctor_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, doctor_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn bác sĩ" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor._id} value={doctor._id}>
                            {doctor.fullname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Ngày và giờ hẹn <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.appointment_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          appointment_date: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Trạng thái <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Scheduled">Đã lên lịch</SelectItem>
                        <SelectItem value="Completed">Hoàn thành</SelectItem>
                        <SelectItem value="Cancelled">Đã huỷ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Lý do khám
                  </label>
                  <Input
                    value={formData.reason || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="Nhập lý do khám"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpenCreate(false);
                      handleCancel();
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={handleSaveCreate} disabled={isSaving}>
                    {isSaving ? "⏳ Đang tạo..." : "💾 Tạo lịch hẹn"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict modal */}
      <Dialog open={conflictModalOpen} onOpenChange={(v) => setConflictModalOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600">⚠️ Lịch trùng</DialogTitle>
            <DialogDescription>{conflictInfo}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setConflictModalOpen(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🗑️ Dialog xác nhận xóa lịch hẹn */}
      <Dialog
        open={openDeleteConfirm}
        onOpenChange={(isOpen) => {
          setOpenDeleteConfirm(isOpen);
          if (!isOpen) {
            setDeleteAppointmentId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">
              ⚠️ Xác nhận xóa lịch hẹn
            </DialogTitle>
            <DialogDescription className="pt-2">
              Bạn có chắc chắn muốn xóa lịch hẹn này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpenDeleteConfirm(false);
                setDeleteAppointmentId(null);
              }}
              disabled={deletingId !== null}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId !== null ? "⏳ Đang xóa..." : "Xóa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
