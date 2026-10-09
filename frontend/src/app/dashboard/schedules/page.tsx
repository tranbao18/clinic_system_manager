
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import SchedulesService, { ShiftSchedule } from "@/lib/services/schedulesService";
import { getAppointments, Appointment, toIdString } from "@/lib/services/appointmentsService";
import EmployeesService from "@/lib/services/employeesService";

interface ScheduleItem {
    date: string;
    start: string;
    end: string;
}

interface ScheduleDetail extends ScheduleItem {
    employee_id: string;
    employee_name: string;
    employee_position: string;
}

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const DEFAULT_SHIFT_START = "08:00";
const DEFAULT_SHIFT_END = "16:00";
const MIN_SHIFT_MINUTES = 8 * 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

// Ca qua đêm (dữ liệu cũ, end <= start) được tính sang ngày hôm sau khi so trùng
const shiftRange = (item: ScheduleItem): [number, number] => {
    const start = toMinutes(item.start);
    let end = toMinutes(item.end);
    if (end <= start) end += 24 * 60;
    return [start, end];
};

// Chuẩn hóa về [{ date, start, end }] và bỏ các key ngoài schema (vd: _id)
function normalizeShifts(raw: unknown): ScheduleItem[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw
            .map((item): ScheduleItem | null => {
                if (typeof item === "string") {
                    return { date: item, start: DEFAULT_SHIFT_START, end: DEFAULT_SHIFT_END };
                }
                if (item && typeof item === "object" && (item as any).date) {
                    return {
                        date: String((item as any).date),
                        start: String((item as any).start || DEFAULT_SHIFT_START),
                        end: String((item as any).end || DEFAULT_SHIFT_END),
                    };
                }
                return null;
            })
            .filter((item): item is ScheduleItem => item !== null);
    }
    if (typeof raw === "object") {
        return Object.keys(raw as Record<string, any>).map((date) => {
            const val = (raw as Record<string, any>)[date];
            return {
                date,
                start: String(val?.start || DEFAULT_SHIFT_START),
                end: String(val?.end || DEFAULT_SHIFT_END),
            };
        });
    }
    return [];
}

const isSameShift = (a: ScheduleItem, b: ScheduleItem) =>
    a.date === b.date && a.start === b.start && a.end === b.end;

function validateShiftTimes(start: string, end: string): string | null {
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        return "Giờ trực không hợp lệ (định dạng HH:mm)";
    }
    let diff = toMinutes(end) - toMinutes(start);
    if (diff === 0) return "Giờ bắt đầu và giờ kết thúc không được trùng nhau";
    if (diff < 0) diff += 24 * 60; // ca qua đêm (vd 22:00 - 06:00), backend cũng chấp nhận
    if (diff < MIN_SHIFT_MINUTES) return "Thời gian trực phải tối thiểu 8 giờ";
    return null;
}

// Thêm ca mới (original = null) hoặc thay đúng ca đang sửa; một ngày có thể có nhiều ca miễn không trùng giờ
function applyShiftChange(
    list: ScheduleItem[],
    original: ScheduleItem | null,
    next: ScheduleItem
): { items: ScheduleItem[]; error?: string } {
    const items = normalizeShifts(list);
    let index = -1;
    if (original) {
        index = items.findIndex((item) => isSameShift(item, original));
        if (index < 0) {
            return { items, error: "Ca trực cần sửa không còn tồn tại. Vui lòng tải lại trang." };
        }
    }
    const [nextStart, nextEnd] = shiftRange(next);
    const overlap = items.find((item, idx) => {
        if (idx === index || item.date !== next.date) return false;
        const [start, end] = shiftRange(item);
        return start < nextEnd && nextStart < end;
    });
    if (overlap) {
        return { items, error: `Ca trực bị trùng giờ với ca ${overlap.start} - ${overlap.end} trong cùng ngày` };
    }
    if (index >= 0) items[index] = next;
    else items.push(next);
    return { items };
}

function removeShift(list: ScheduleItem[], target: ScheduleItem): ScheduleItem[] {
    const items = normalizeShifts(list);
    const index = items.findIndex((item) => isSameShift(item, target));
    if (index >= 0) items.splice(index, 1);
    return items;
}

function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateDisplay(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return dateStr;
}

function formatTimeDisplay(timeStr: string): string {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    return `${hours.padStart(2, "0")}:${minutes || "00"}`;
}

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

export default function SchedulesPage() {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [employees, setEmployees] = useState<Array<{ _id: string; fullname: string; position: string }>>([]);
    const [role, setRole] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const [openDetailDialog, setOpenDetailDialog] = useState(false);
    const [openFormDialog, setOpenFormDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openNotificationDialog, setOpenNotificationDialog] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSchedules, setSelectedSchedules] = useState<ScheduleDetail[]>([]);
    const [editingScheduleDetail, setEditingScheduleDetail] = useState<ScheduleDetail | null>(null);

    const [formEmployeeId, setFormEmployeeId] = useState<string>("");
    const [formDate, setFormDate] = useState<string>(""); // Lưu dạng YYYY-mm-dd
    const [formDateDisplay, setFormDateDisplay] = useState<string>(""); // Hiển thị dạng d/m/Y
    const [formStart, setFormStart] = useState<string>("08:00");
    const [formEnd, setFormEnd] = useState<string>("16:00");
    const [openDatePicker, setOpenDatePicker] = useState(false);
    const [datePickerMonth, setDatePickerMonth] = useState(today.getMonth());
    const [datePickerYear, setDatePickerYear] = useState(today.getFullYear());

    const showNotification = (type: "success" | "error" | "warning", message: string) => {
        setNotificationMessage({ type, message });
        setOpenNotificationDialog(true);
    };

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const res = await fetch("/api/session", { cache: "no-store" });
                const data = await res.json();
                setRole(data?.user?.role?.toLowerCase() || "");
            } catch (err) {
                console.error("Error fetching role:", err);
            }
        };
        fetchRole();
    }, []);

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                setLoading(true);
                const data = await SchedulesService.getAll();
                setSchedules(Array.isArray(data) ? data : [data]);
            } catch (err) {
                console.error("Error fetching schedules:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedules();
    }, []);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const data = await getAppointments();
                setAppointments(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Error fetching appointments:", err);
                setAppointments([]);
            }
        };
        fetchAppointments();
    }, []);

    useEffect(() => {
        const fetchEmployees = async () => {
            if (role === "admin") {
                try {
                    const data = await EmployeesService.getAll();
                    setEmployees(data);
                } catch (err) {
                    console.error("Error fetching employees:", err);
                }
            }
        };
        fetchEmployees();
    }, [role]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (openDatePicker && !target.closest('.date-picker-container')) {
                setOpenDatePicker(false);
            }
        };

        if (openDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [openDatePicker]);

    const getSchedulesByDate = (date: Date): ScheduleDetail[] => {
        const dateStr = formatDateInput(date);
        const details: ScheduleDetail[] = [];

        schedules.forEach((schedule) => {
            const shifts = normalizeShifts(schedule.shift_schedule);
            if (shifts.length === 0) return;

            let position = schedule.employee_position;
            if (!position && role === "admin") {
                const employee = employees.find(emp => emp._id === schedule.employee_id);
                position = employee?.position;
            }

            shifts.forEach((item: ScheduleItem) => {
                if (item.date === dateStr) {
                    details.push({
                        ...item,
                        employee_id: schedule.employee_id,
                        employee_name: schedule.employee_name,
                        employee_position: position || "N/A",
                    });
                }
            });
        });

        return details;
    };

    const handleClickDate = (date: Date) => {
        const dateSchedules = getSchedulesByDate(date);
        if (dateSchedules.length > 0) {
            setSelectedDate(date);
            setSelectedSchedules(dateSchedules);
            setOpenDetailDialog(true);
        }
    };

    const handleCreate = () => {
        setEditingScheduleDetail(null);
        setFormEmployeeId("");
        setFormDate("");
        setFormDateDisplay("");
        setFormStart("08:00");
        setFormEnd("16:00");
        setDatePickerMonth(today.getMonth());
        setDatePickerYear(today.getFullYear());
        setOpenFormDialog(true);
    };

    const handleEdit = (scheduleDetail: ScheduleDetail) => {
        setEditingScheduleDetail(scheduleDetail);
        setFormEmployeeId(scheduleDetail.employee_id);
        setFormDate(scheduleDetail.date);
        setFormDateDisplay(formatDateDisplay(scheduleDetail.date));
        setFormStart(scheduleDetail.start);
        setFormEnd(scheduleDetail.end);
        const selectedDate = parseDateDisplay(formatDateDisplay(scheduleDetail.date));
        if (selectedDate) {
            const [year, month] = selectedDate.split("-").map(Number);
            setDatePickerMonth(month - 1);
            setDatePickerYear(year);
        }
        setOpenDetailDialog(false);
        setOpenFormDialog(true);
    };

    const handleDateSelect = (date: Date) => {
        const dateStr = formatDateInput(date);
        setFormDate(dateStr);
        setFormDateDisplay(formatDateDisplay(dateStr));
        setOpenDatePicker(false);
    };

    const handleDelete = (scheduleDetail: ScheduleDetail) => {
        setEditingScheduleDetail(scheduleDetail);
        setOpenDetailDialog(false);
        setOpenDeleteDialog(true);
    };

    const handleSave = async () => {
        try {
            if (!formEmployeeId) {
                showNotification("warning", "Vui lòng chọn nhân viên");
                return;
            }

            let dateToSave = formDate;
            if (!dateToSave && formDateDisplay) {
                dateToSave = parseDateDisplay(formDateDisplay);
            }

            if (!dateToSave) {
                showNotification("warning", "Vui lòng chọn ngày");
                return;
            }

            const timeError = validateShiftTimes(formStart, formEnd);
            if (timeError) {
                showNotification("warning", timeError);
                return;
            }

            const scheduleItem: ScheduleItem = {
                date: dateToSave,
                start: formStart,
                end: formEnd,
            };

            const existingSchedule = schedules.find(s => toIdString(s.employee_id) === formEmployeeId);
            // Sửa đúng ca đã chọn (theo ngày + giờ bắt đầu + giờ kết thúc), không ghi đè theo ngày
            const originalShift = editingScheduleDetail && editingScheduleDetail.employee_id === formEmployeeId
                ? { date: editingScheduleDetail.date, start: editingScheduleDetail.start, end: editingScheduleDetail.end }
                : null;
            const { items: newSchedule, error: shiftError } = applyShiftChange(
                normalizeShifts(existingSchedule?.shift_schedule),
                originalShift,
                scheduleItem
            );
            if (shiftError) {
                showNotification("warning", shiftError);
                return;
            }

            if (editingScheduleDetail) {
                await SchedulesService.update(formEmployeeId, newSchedule);
            } else {
                await SchedulesService.create({
                    employee_id: formEmployeeId,
                    shift_schedule: newSchedule,
                });
            }

            const data = await SchedulesService.getAll();
            setSchedules(Array.isArray(data) ? data : [data]);
            setOpenFormDialog(false);
            setOpenDatePicker(false);
            showNotification("success", "Lưu lịch trực thành công!");
        } catch (err: unknown) {
            console.error("Error saving schedule:", err);
            const msg = err instanceof Error ? err.message : "Lỗi khi lưu lịch trực";
            showNotification("error", msg);
        }
    };

    const handleConfirmDelete = async () => {
        if (!editingScheduleDetail) return;

        try {
            const existingSchedule = schedules.find(s => toIdString(s.employee_id) === editingScheduleDetail.employee_id);

            if (existingSchedule) {
                const newSchedule = removeShift(normalizeShifts(existingSchedule.shift_schedule), {
                    date: editingScheduleDetail.date,
                    start: editingScheduleDetail.start,
                    end: editingScheduleDetail.end,
                });

                if (newSchedule.length === 0) {
                    await SchedulesService.delete(editingScheduleDetail.employee_id);
                } else {
                    await SchedulesService.update(editingScheduleDetail.employee_id, newSchedule);
                }
            }

            const data = await SchedulesService.getAll();
            setSchedules(Array.isArray(data) ? data : [data]);
            setOpenDeleteDialog(false);
            showNotification("success", "Xóa lịch trực thành công!");
        } catch (err: unknown) {
            console.error("Error deleting schedule:", err);
            const msg = err instanceof Error ? err.message : "Lỗi khi xóa lịch trực";
            showNotification("error", msg);
        }
    };

    const weeks = generateCalendar(currentYear, currentMonth);
    const monthNames = [
        "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
    ];
    const yearRange = Array.from(
        { length: 11 },
        (_, i) => today.getFullYear() - 5 + i
    );
    const isAdmin = role === "admin";

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center h-64">
                    <div>Đang tải...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">
                    {isAdmin ? "📅 Quản lý lịch trực" : "📅 Lịch trực của bạn"}
                </h1>
                {isAdmin && (
                    <Button onClick={handleCreate}>+ Thêm lịch trực</Button>
                )}
            </div>

            {/* Calendar View */}
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

                                const daySchedules = getSchedulesByDate(date);

                                return (
                                    <div
                                        key={wi + "-" + di}
                                        onClick={() => daySchedules.length > 0 && handleClickDate(date)}
                                        className={cn(
                                            "p-2 border rounded text-sm min-h-[80px] text-left transition",
                                            daySchedules.length > 0 && "cursor-pointer hover:bg-blue-50",
                                            formatDateInput(date) === formatDateInput(today) &&
                                            "bg-blue-100 font-bold"
                                        )}
                                    >
                                        <div className="font-medium">{date.getDate()}</div>
                                        <div className="space-y-1 mt-1">
                                            {daySchedules.length > 0 ? (
                                                daySchedules.map((s, i) => {
                                                    const hasCompletedAppointment = appointments.some((apt) => {
                                                        try {
                                                            const aptDate = new Date(apt.appointment_date);
                                                            const aptDateStr = formatDateInput(aptDate);
                                                            // doctor_id đã được populate thành object → so theo id
                                                            return toIdString(apt.doctor_id) === String(s.employee_id) &&
                                                                aptDateStr === formatDateInput(date) &&
                                                                (apt.status === "Completed" || apt.status === "completed" || apt.status === "Hoàn thành");
                                                        } catch (e) {
                                                            return false;
                                                        }
                                                    });

                                                    return (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "p-1 rounded text-xs truncate",
                                                                hasCompletedAppointment ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-700"
                                                            )}
                                                        >
                                                            {s.employee_name} ({formatTimeDisplay(s.start)} - {formatTimeDisplay(s.end)}){hasCompletedAppointment ? " — Đã khám" : ""}
                                                        </div>
                                                    );
                                                })
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

            {/* Dialog chi tiết lịch trực */}
            <Dialog open={openDetailDialog} onOpenChange={setOpenDetailDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Lịch trực ngày {selectedDate && formatDateDisplay(formatDateInput(selectedDate))}
                        </DialogTitle>
                        <DialogDescription>
                            Chi tiết các ca trực trong ngày này.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedSchedules.map((schedule, index) => (
                        <div key={index} className="border rounded p-3 mb-2">
                            <p><strong>Tên:</strong> {schedule.employee_name}</p>
                            <p><strong>Chức vụ:</strong> {schedule.employee_position}</p>
                            <p><strong>Thời gian bắt đầu trực:</strong> {formatTimeDisplay(schedule.start)}</p>
                            <p><strong>Thời gian kết thúc:</strong> {formatTimeDisplay(schedule.end)}</p>
                            {isAdmin && (
                                <div className="flex gap-2 mt-3">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="bg-yellow-500 text-white hover:bg-yellow-600"
                                        onClick={() => handleEdit(schedule)}
                                    >
                                        Chỉnh sửa
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="bg-red-500 text-white hover:bg-red-600"
                                        onClick={() => handleDelete(schedule)}
                                    >
                                        Xóa
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </DialogContent>
            </Dialog>

            {/* Dialog form tạo/sửa lịch trực */}
            <Dialog open={openFormDialog} onOpenChange={setOpenFormDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingScheduleDetail ? "Chỉnh sửa lịch trực" : "Thêm lịch trực"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingScheduleDetail
                                ? "Cập nhật thông tin lịch trực."
                                : "Điền thông tin để tạo lịch trực mới. Thời gian trực tối thiểu là 8 giờ; một ngày có thể có nhiều ca không trùng giờ."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Chọn nhân viên
                            </label>
                            <Select
                                value={formEmployeeId}
                                onValueChange={setFormEmployeeId}
                                disabled={!!editingScheduleDetail}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn nhân viên" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp._id} value={emp._id}>
                                            {emp.fullname} ({emp.position})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative date-picker-container">
                            <label className="text-sm font-medium mb-2 block">
                                Ngày trực
                            </label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    placeholder="Chọn ngày (dd/mm/yyyy)"
                                    value={formDateDisplay}
                                    readOnly
                                    onClick={() => setOpenDatePicker(true)}
                                    className="cursor-pointer"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                                    onClick={() => setOpenDatePicker(true)}
                                >
                                    📅
                                </Button>
                            </div>
                            {formDate && (
                                <p className="text-xs text-green-600 mt-1">
                                    ✓ Ngày đã chọn: {formatDateDisplay(formDate)}
                                </p>
                            )}

                            {/* Date Picker Calendar */}
                            {openDatePicker && (
                                <div className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg p-4 w-[320px] left-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                let newMonth = datePickerMonth - 1;
                                                let newYear = datePickerYear;
                                                if (newMonth < 0) {
                                                    newMonth = 11;
                                                    newYear = datePickerYear - 1;
                                                }
                                                setDatePickerMonth(newMonth);
                                                setDatePickerYear(newYear);
                                            }}
                                            className="px-2 py-1 hover:bg-gray-100 rounded"
                                        >
                                            ←
                                        </button>
                                        <div className="font-semibold">
                                            {monthNames[datePickerMonth]} {datePickerYear}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                let newMonth = datePickerMonth + 1;
                                                let newYear = datePickerYear;
                                                if (newMonth > 11) {
                                                    newMonth = 0;
                                                    newYear = datePickerYear + 1;
                                                }
                                                setDatePickerMonth(newMonth);
                                                setDatePickerYear(newYear);
                                            }}
                                            className="px-2 py-1 hover:bg-gray-100 rounded"
                                        >
                                            →
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-2">
                                        {weekdays.map((day) => (
                                            <div key={day} className="p-2">{day}</div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1">
                                        {generateCalendar(datePickerYear, datePickerMonth).flat().map((date, idx) => {
                                            if (!date) {
                                                return <div key={idx} className="p-2"></div>;
                                            }

                                            const dateStr = formatDateInput(date);
                                            const isSelected = formDate === dateStr;
                                            const isToday = formatDateInput(today) === dateStr;

                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleDateSelect(date)}
                                                    className={cn(
                                                        "p-2 text-sm rounded hover:bg-blue-100 transition",
                                                        isSelected && "bg-blue-500 text-white hover:bg-blue-600",
                                                        isToday && !isSelected && "bg-blue-100 font-bold",
                                                        !date && "opacity-30"
                                                    )}
                                                >
                                                    {date.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-end gap-2 mt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDateSelect(today)}
                                        >
                                            Hôm nay
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setOpenDatePicker(false)}
                                        >
                                            Đóng
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Thời gian bắt đầu
                            </label>
                            <Input
                                type="time"
                                value={formStart}
                                onChange={(e) => setFormStart(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Thời gian kết thúc
                            </label>
                            <Input
                                type="time"
                                value={formEnd}
                                onChange={(e) => setFormEnd(e.target.value)}
                            />
                            {formStart && formEnd && validateShiftTimes(formStart, formEnd) && (
                                <p className="text-sm text-red-500 mt-1">
                                    {validateShiftTimes(formStart, formEnd)}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => {
                                setOpenFormDialog(false);
                                setOpenDatePicker(false);
                            }}>
                                Hủy
                            </Button>
                            <Button className="bg-green-500 text-white hover:bg-green-600" onClick={handleSave}>Lưu</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog confirm xóa */}
            <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận xóa lịch trực</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc muốn xóa lịch trực này không?
                        </DialogDescription>
                    </DialogHeader>
                    {editingScheduleDetail && (
                        <div className="border rounded p-3 mb-4">
                            <p><strong>Tên:</strong> {editingScheduleDetail.employee_name}</p>
                            <p><strong>Chức vụ:</strong> {editingScheduleDetail.employee_position}</p>
                            <p><strong>Ngày:</strong> {formatDateDisplay(editingScheduleDetail.date)}</p>
                            <p><strong>Thời gian:</strong> {formatTimeDisplay(editingScheduleDetail.start)} - {formatTimeDisplay(editingScheduleDetail.end)}</p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>
                            Hủy
                        </Button>
                        <Button variant="destructive" className="bg-red-500 text-white hover:bg-red-600" onClick={handleConfirmDelete}>
                            Xóa
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog thông báo */}
            <Dialog open={openNotificationDialog} onOpenChange={setOpenNotificationDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className={cn(
                            notificationMessage?.type === "success" && "text-green-600",
                            notificationMessage?.type === "error" && "text-red-600",
                            notificationMessage?.type === "warning" && "text-yellow-600"
                        )}>
                            {notificationMessage?.type === "success" && "Thành công"}
                            {notificationMessage?.type === "error" && "Lỗi"}
                            {notificationMessage?.type === "warning" && "Cảnh báo"}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mb-4">
                        {notificationMessage?.message}
                    </p>
                    <div className="flex justify-end">
                        <Button onClick={() => setOpenNotificationDialog(false)}>
                            Đóng
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

