"use client";

import { MedicalRecord } from "@/lib/services/medicalRecordService";
import { Patient } from "@/lib/services/patientsService";

interface PrintPrescriptionProps {
    record: MedicalRecord;
    patient: Patient | null;
    formatDateTime: (date: string) => string;
}

export const printPrescription = (record: MedicalRecord, patient: Patient | null, formatDateTime: (date: string) => string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        throw new Error("Không thể mở cửa sổ in. Vui lòng kiểm tra cài đặt trình duyệt.");
    }

    const doctorName = typeof record.doctor_id === 'object' ? record.doctor_id.fullname : '—';
    const patientName = patient?.fullname || '—';
    const patientPhone = patient?.phone || '—';
    const recordDate = formatDateTime(record.created_at);

    const formatDate = (dateString: string) => {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return dateString;
        }
    };

    const patientDob = patient?.dob ? formatDate(patient.dob) : '—';

    const mapGender = (gender: string | undefined) => {
        if (!gender) return '—';
        if (gender === "Male") return "Nam";
        if (gender === "Female") return "Nữ";
        return gender;
    };

    const patientGender = mapGender(patient?.gender);

    const prescriptionData = record.prescriptions.map((p: any, idx: number) => {
        const medicine = typeof p.medicine_id === 'object' ? p.medicine_id : null;
        const price = medicine?.price || 0;
        const quantity = p.quantity || 0;
        const totalPrice = price * quantity;

        return {
            stt: idx + 1,
            medicine: medicine?.name || '—',
            unit: medicine?.unit || '—',
            quantity: quantity,
            price: price,
            totalPrice: totalPrice,
            dosage: p.dosage || '—',
        };
    });

    const totalAmount = prescriptionData.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

    const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Toa thuốc - ${patientName}</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 12mm; /* reduced from 20mm to fit content on one page */
            }
            html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            .no-print {
                display: none !important;
            }
        }
        body {
            font-family: 'Times New Roman', serif;
            font-size: 13px; /* slightly smaller to help fit content */
            line-height: 1.45;
            color: #000;
            padding: 0; /* removed extra padding to maximize printable area */
        }
        .header {
            text-align: center;
            margin-bottom: 18px; /* reduced spacing */
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        .clinic-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .clinic-address {
            font-size: 12px;
            margin-bottom: 5px;
        }
        .title {
            font-size: 17px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 10px;
        }
        .info-section {
            margin: 10px 0;
        }
        .info-row {
            display: flex;
            margin-bottom: 8px;
        }
        .info-label {
            font-weight: bold;
            width: 150px;
        }
        .info-value {
            flex: 1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 13px;
        }
        th, td {
            border: 1px solid #000;
            padding: 6px; /* reduced padding to save space */
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
        }
        td {
            text-align: left;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .total-section {
            margin-top: 10px;
            text-align: right;
            font-size: 15px;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
        }
        .signature {
            text-align: center;
            width: 200px;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
            padding-top: 5px;
        }
        .diagnosis {
            margin: 15px 0;
            padding: 10px;
            background-color: #f9f9f9;
            border-left: 3px solid #000;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="clinic-name">PHÒNG KHÁM ĐA KHOA BẢO PHÁT</div>
        <div class="clinic-address">Địa chỉ: 656 Cách Mạng Tháng 8, Phường Nhiêu Lộc, Quận 3, TP.HCM</div>
        <div class="clinic-address">Điện thoại: 1900 8495</div>
    </div>
    
    <div class="title">TOA THUỐC</div>
    
    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Bệnh nhân:</span>
            <span class="info-value">${patientName}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Sinh ngày:</span>
            <span class="info-value">${patientDob}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Giới tính:</span>
            <span class="info-value">${patientGender}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Ngày khám:</span>
            <span class="info-value">${recordDate}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Bác sĩ:</span>
            <span class="info-value">${doctorName}</span>
        </div>
    </div>
    
    <div class="diagnosis">
        <strong>Chẩn đoán:</strong> ${record.diagnosis || '—'}
    </div>
    
    ${record.treatment ? `
    <div class="diagnosis">
        <strong>Điều trị:</strong> ${record.treatment}
    </div>
    ` : ''}
    
    <table>
        <thead>
            <tr>
                <th style="width: 5%;">STT</th>
                <th style="width: 30%;">Tên thuốc</th>
                <th style="width: 10%;">Số lượng</th>
                <th style="width: 10%;">Đơn vị</th>
                <th style="width: 15%;">Đơn giá</th>
                <th style="width: 15%;">Thành tiền</th>
                <th style="width: 15%;">Liều dùng</th>
            </tr>
        </thead>
        <tbody>
            ${prescriptionData.map((item: any) => `
            <tr>
                <td class="text-center">${item.stt}</td>
                <td>${item.medicine}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">${item.unit}</td>
                <td class="text-right">${item.price > 0 ? item.price.toLocaleString('vi-VN') + ' đ' : '—'}</td>
                <td class="text-right">${item.totalPrice > 0 ? item.totalPrice.toLocaleString('vi-VN') + ' đ' : '—'}</td>
                <td>${item.dosage}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="total-section">
        <div>Tổng tiền: <strong>${totalAmount.toLocaleString('vi-VN')} đ</strong></div>
    </div>
    
    ${record.notes ? `
    <div class="diagnosis">
        <strong>Ghi chú:</strong> ${record.notes}
    </div>
    ` : ''}
    
    <div class="footer">
        <div></div>
        <div class="signature">
            <div class="signature-line">
                <strong>Bác sĩ ký</strong><br/>
                ${doctorName}
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
};

