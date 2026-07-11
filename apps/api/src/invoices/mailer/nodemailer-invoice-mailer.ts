import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { InvoiceMailer, SendInvoiceParams, SendOverdueReminderParams } from './invoice-mailer.interface';

@Injectable()
export class NodemailerInvoiceMailer implements InvoiceMailer {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT')),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendInvoice(params: SendInvoiceParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to: params.toEmail,
      subject: `청구서 안내 (납부기한: ${params.dueDate.toISOString().slice(0, 10)})`,
      text: `청구 금액: ${params.totalAmount}원. 납부기한: ${params.dueDate.toISOString().slice(0, 10)}. 첨부된 PDF를 확인해 주세요.`,
      attachments: [{ filename: params.pdfFileName, content: params.pdfBuffer }],
    });
  }

  async sendOverdueReminder(params: SendOverdueReminderParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to: params.toEmail,
      subject: `[미납 안내] 청구서 납부기한이 지났습니다 (납부기한: ${params.dueDate.toISOString().slice(0, 10)})`,
      text: `청구 금액: ${params.totalAmount}원. 납부기한(${params.dueDate.toISOString().slice(0, 10)})이 지났습니다. 빠른 시일 내에 납부해 주시기 바랍니다.`,
    });
  }
}
