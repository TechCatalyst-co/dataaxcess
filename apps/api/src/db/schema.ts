import { model, Schema } from "mongoose";

export const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, maxlength: 50 },
    passwordHash: { type: String, required: true, maxlength: 255 },
    fullName: { type: String, required: true, maxlength: 100 },
    role: { type: String, enum: ["admin", "agent"], required: true, default: "agent" },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
    failedLoginAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date },
    deletedAt: { type: Date },
  },
  { toJSON: { virtuals: true } },
);

userSchema.virtual("id").get(function (this: { _id: unknown }) {
  return (this._id as { toHexString: () => string }).toHexString();
});

userSchema.index({ deletedAt: 1 });

export const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    lastActivityAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
  },
  { toJSON: { virtuals: true } },
);

sessionSchema.index({ userId: 1 });

export const invoiceSchema = new Schema(
  {
    _id: { type: String, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    vin: { type: String, required: true, maxlength: 17 },
    vehicleStock: { type: String, maxlength: 50 },
    year: { type: Number, required: true },
    make: { type: String, required: true, maxlength: 50 },
    model: { type: String, required: true, maxlength: 50 },
    bodyStyle: { type: String, maxlength: 30 },
    countryOfOrigin: { type: String, maxlength: 50 },
    odometer: { type: Number },
    titleStatus: { type: String, maxlength: 30 },
    damageHistory: { type: String },
    saleDate: { type: Date },
    dateOfSale: { type: Date },
    vehiclePrice: { type: String, maxlength: 50 },
    totalSales: { type: String, maxlength: 50 },
    auctionSource: { type: String, maxlength: 100 },
    buyerType: { type: String, maxlength: 20 },
    buyerCompany: { type: String, maxlength: 100 },
    buyerAddress: { type: String, maxlength: 200 },
    buyerCity: { type: String, maxlength: 100 },
    buyerRfc: { type: String, maxlength: 20 },
    dataAnalyst: { type: String, maxlength: 255 },
    sourceVerification: { type: String, maxlength: 50 },
    verified: { type: String, maxlength: 10, default: "No" },
    reportDate: { type: Date, required: true, default: Date.now },
  },
  { toJSON: { virtuals: true } },
);

invoiceSchema.virtual("invoiceNumber").get(function (this: { _id: string }) {
  return this._id;
});

invoiceSchema.index({ createdByUserId: 1 });
invoiceSchema.index({ year: 1 });
invoiceSchema.index({ titleStatus: 1 });
invoiceSchema.index({ dateOfSale: 1 });
invoiceSchema.index({ buyerType: 1 });
invoiceSchema.index({ vin: 1 });
invoiceSchema.index({ reportDate: 1 });

export const appSettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

export const User = model("User", userSchema);
export const Session = model("Session", sessionSchema);
export const Invoice = model("Invoice", invoiceSchema);
export const AppSetting = model("AppSetting", appSettingSchema);
