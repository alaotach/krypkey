import React, { useState, useEffect,useMemo } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, 
  ListRenderItem, ActivityIndicator, Alert, Modal, Switch, 
  ScrollView, KeyboardAvoidingView, Platform, Pressable, Linking
} from 'react-native';
import { 
  Key, Plus, Eye, EyeOff, User, Trash2, Lock, Fingerprint, 
  CreditCard, Gift, Tag, Globe, Share2, Menu, MapPin, FileText
} from 'lucide-react-native';
import axios from 'axios';
import { SecureStorage } from '../../utils/storage';
import { useRouter } from 'expo-router';
import { EncryptionService } from '../../utils/encryption';
import { RefreshControl } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { BackHandler } from 'react-native';
import * as Haptics from 'expo-haptics';
// import DateTimePicker from '@react-native-community/datetimepicker';s
import { format } from 'date-fns';

// Add this after your imports section

// Function to render forms for each password category
const renderAddForm = (activeCategory: string) => {
  switch (activeCategory) {
    case PASSWORD_CATEGORIES.LOGIN:
      return (
        <LoginForm 
          title={loginTitle}
          setTitle={setLoginTitle}
          username={loginUsername}
          setUsername={setLoginUsername}
          password={loginPassword}
          setPassword={setLoginPassword}
          website={loginWebsite}
          setWebsite={setLoginWebsite}
          notes={loginNotes}
          setNotes={setLoginNotes}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.SOCIAL:
      return (
        <SocialForm
          title={socialTitle}
          setTitle={setSocialTitle}
          platform={socialPlatform}
          setPlatform={setSocialPlatform}
          username={socialUsername}
          setUsername={setSocialUsername}
          password={socialPassword}
          setPassword={setSocialPassword}
          profileUrl={socialProfileUrl}
          setProfileUrl={setSocialProfileUrl}
          notes={socialNotes}
          setNotes={setSocialNotes}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.CARD:
      return (
        <CardForm
          title={cardTitle}
          setTitle={setCardTitle}
          cardType={cardType}
          setCardType={setCardType}
          cardTypes={CARD_TYPES}
          showTypeDropdown={showCardTypeDropdown}
          setShowTypeDropdown={setShowCardTypeDropdown}
          cardNumber={cardNumber}
          setCardNumber={setCardNumber}
          cardholderName={cardholderName}
          setCardholderName={setCardholderName}
          expiry={cardExpiry}
          setExpiry={setCardExpiry}
          showDatePicker={showDatePicker}
          setShowDatePicker={setShowDatePicker}
          cvv={cardCVV}
          setCvv={setCardCVV}
          notes={cardNotes}
          setNotes={setCardNotes}
          formatDate={formatDate}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.VOUCHER:
      return (
        <VoucherForm
          title={voucherTitle}
          setTitle={setVoucherTitle}
          store={voucherStore}
          setStore={setVoucherStore}
          code={voucherCode}
          setCode={setVoucherCode}
          value={voucherValue}
          setValue={setVoucherValue}
          expiry={voucherExpiry}
          setExpiry={setVoucherExpiry}
          showDatePicker={showVoucherDatePicker}
          setShowDatePicker={setVoucherDatePicker}
          notes={voucherNotes}
          setNotes={setVoucherNotes}
          formatDate={formatDate}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.GIFT_CARD:
      return (
        <GiftCardForm
          title={giftCardTitle}
          setTitle={setGiftCardTitle}
          store={giftCardStore}
          setStore={setGiftCardStore}
          cardNumber={giftCardNumber}
          setCardNumber={setGiftCardNumber}
          pin={giftCardPin}
          setPin={setGiftCardPin}
          balance={giftCardBalance}
          setBalance={setGiftCardBalance}
          expiry={giftCardExpiry}
          setExpiry={setGiftCardExpiry}
          showDatePicker={showGiftCardDatePicker}
          setShowDatePicker={setShowGiftCardDatePicker}
          notes={giftCardNotes}
          setNotes={setGiftCardNotes}
          formatDate={formatDate}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.ADDRESS:
      return (
        <AddressForm
          title={addressTitle}
          setTitle={setAddressTitle}
          fullName={addressFullName}
          setFullName={setAddressFullName}
          street={addressStreet}
          setStreet={setAddressStreet}
          city={addressCity}
          setCity={setAddressCity}
          state={addressState}
          setState={setAddressState}
          zipCode={addressZipCode}
          setZipCode={setAddressZipCode}
          country={addressCountry}
          setCountry={setAddressCountry}
          phone={addressPhone}
          setPhone={setAddressPhone}
          email={addressEmail}
          setEmail={setAddressEmail}
          notes={addressNotes}
          setNotes={setAddressNotes}
          onSave={handleAddPassword}
        />
      );
      
    case PASSWORD_CATEGORIES.OTHER:
      return (
        <OtherForm
          title={otherTitle}
          setTitle={setOtherTitle}
          customFields={otherCustomFields}
          onAddField={handleAddCustomField}
          onRemoveField={handleRemoveCustomField}
          onUpdateField={updateCustomField}
          notes={otherNotes}
          setNotes={setOtherNotes}
          onSave={handleAddPassword}
        />
      );
      
    default:
      return (
        <View style={styles.addContainer}>
          <Text style={styles.errorText}>Unknown category selected.</Text>
        </View>
      );
  }
};

// Form Components
const LoginForm = ({ 
  title, setTitle, 
  username, setUsername, 
  password, setPassword, 
  website, setWebsite,
  notes, setNotes,
  onSave
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addContainer}
    >
      <Text style={styles.formTitle}>Add Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Username or Email"
        placeholderTextColor="#6b7280"
        value={username}
        onChangeText={setUsername}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Website (optional)"
        placeholderTextColor="#6b7280"
        value={website}
        onChangeText={setWebsite}
        keyboardType="url"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const SocialForm = ({
  title, setTitle,
  platform, setPlatform,
  username, setUsername,
  password, setPassword,
  profileUrl, setProfileUrl,
  notes, setNotes,
  onSave
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addContainer}
    >
      <Text style={styles.formTitle}>Add Social Media Account</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Platform (e.g., Facebook, Twitter)"
        placeholderTextColor="#6b7280"
        value={platform}
        onChangeText={setPlatform}
      />
      <TextInput
        style={styles.input}
        placeholder="Username or Email"
        placeholderTextColor="#6b7280"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Profile URL (optional)"
        placeholderTextColor="#6b7280"
        value={profileUrl}
        onChangeText={setProfileUrl}
        keyboardType="url"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Social Account</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const CardForm = ({
  title, setTitle,
  cardType, setCardType, cardTypes,
  showTypeDropdown, setShowTypeDropdown,
  cardNumber, setCardNumber,
  cardholderName, setCardholderName,
  cardExpiry, setCardExpiry, // Correct property name
  showDatePicker, setShowDatePicker,
  cvv, setCvv,
  notes, setNotes,
  formatDate,
  onSave
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addContainer}
    >
      <Text style={styles.formTitle}>Add Card</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      
      {/* Card Type Dropdown */}
      <TouchableOpacity 
        style={styles.dropdownButton}
        onPress={() => setShowTypeDropdown(!showTypeDropdown)}
      >
        <Text style={styles.dropdownButtonText}>{cardType || 'Select Card Type'}</Text>
      </TouchableOpacity>
      
      {showTypeDropdown && (
        <View style={styles.dropdownMenu}>
          {cardTypes.map((type, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dropdownItem}
              onPress={() => {
                setCardType(type);
                setShowTypeDropdown(false);
              }}
            >
              <Text style={[
                styles.dropdownItemText,
                cardType === type && styles.dropdownItemTextSelected
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Card Number"
        placeholderTextColor="#6b7280"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="numeric"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Cardholder Name"
        placeholderTextColor="#6b7280"
        value={cardholderName}
        onChangeText={setCardholderName}
      />

      {/* Expiry Date Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: cardExpiry ? '#fff' : '#6b7280' }}>
          {cardExpiry ? formatDate(cardExpiry) : 'Expiry Date (optional)'}
        </Text>
      </TouchableOpacity>
      
      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>Select Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={styles.datePickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.datePickerControls}>
            {/* Year picker */}
            <View style={styles.datePickerField}>
              <Text style={styles.datePickerLabel}>Year</Text>
              <TextInput
                style={styles.datePickerInput}
                keyboardType="number-pad"
                value={cardExpiry ? cardExpiry.getFullYear().toString() : new Date().getFullYear().toString()}
                onChangeText={(text) => {
                  const year = parseInt(text);
                  if (!isNaN(year) && text.length === 4) {
                    const newDate = new Date(cardExpiry || new Date());
                    newDate.setFullYear(year);
                    setCardExpiry(newDate);
                  }
                }}
                maxLength={4}
              />
            </View>
            
            {/* Month picker */}
            <View style={styles.datePickerField}>
              <Text style={styles.datePickerLabel}>Month</Text>
              <TextInput
                style={styles.datePickerInput}
                keyboardType="number-pad"
                value={cardExpiry ? (cardExpiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
                onChangeText={(text) => {
                  const month = parseInt(text);
                  if (!isNaN(month) && month >= 1 && month <= 12) {
                    const newDate = new Date(cardExpiry || new Date());
                    newDate.setMonth(month - 1);
                    setCardExpiry(newDate);
                  }
                }}
                maxLength={2}
              />
            </View>
            
            {/* Day picker */}
            <View style={styles.datePickerField}>
              <Text style={styles.datePickerLabel}>Day</Text>
              <TextInput
                style={styles.datePickerInput}
                keyboardType="number-pad"
                value={cardExpiry ? cardExpiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
                onChangeText={(text) => {
                  const day = parseInt(text);
                  if (!isNaN(day) && day >= 1 && day <= 31) {
                    const newDate = new Date(cardExpiry || new Date());
                    newDate.setDate(day);
                    setCardExpiry(newDate);
                  }
                }}
                maxLength={2}
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: cardExpiry ? '#fff' : '#6b7280' }}>
              {cardExpiry ? formatDate(cardExpiry) : 'Expiry Date (optional)'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TextInput
        style={styles.input}
        placeholder="CVV"
        placeholderTextColor="#6b7280"
        value={cvv}
        onChangeText={setCvv}
        keyboardType="numeric"
        maxLength={4}
        secureTextEntry
      />
      
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Card</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const VoucherForm = ({
  title, setTitle,
  store, setStore,
  code, setCode,
  value, setValue,
  expiry, setExpiry,
  showDatePicker, setShowDatePicker,
  notes, setNotes,
  formatDate,
  onSave
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addContainer}
    >
      <Text style={styles.formTitle}>Add Voucher</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Store/Service"
        placeholderTextColor="#6b7280"
        value={store}
        onChangeText={setStore}
      />
      <TextInput
        style={styles.input}
        placeholder="Code"
        placeholderTextColor="#6b7280"
        value={code}
        onChangeText={setCode}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Value (optional)"
        placeholderTextColor="#6b7280"
        value={value}
        onChangeText={setValue}
      />
      
      {/* Expiry Date Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: expiry ? '#fff' : '#6b7280' }}>
          {expiry ? formatDate(expiry) : 'Expiry Date (optional)'}
        </Text>
      </TouchableOpacity>
      
      {showDatePicker && (
  <View style={styles.datePickerContainer}>
    <View style={styles.datePickerHeader}>
      <Text style={styles.datePickerTitle}>Select Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
        <Text style={styles.datePickerCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
    
    <View style={styles.datePickerControls}>
      {/* Year picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Year</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? expiry.getFullYear().toString() : new Date().getFullYear().toString()}
          onChangeText={(text) => {
            const year = parseInt(text);
            if (!isNaN(year) && text.length === 4) {
              const newDate = new Date(expiry || new Date());
              newDate.setFullYear(year);
              setExpiry(newDate);
            }
          }}
          maxLength={4}
        />
      </View>
      
      {/* Month picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Month</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? (expiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
          onChangeText={(text) => {
            const month = parseInt(text);
            if (!isNaN(month) && month >= 1 && month <= 12) {
              const newDate = new Date(expiry || new Date());
              newDate.setMonth(month - 1);
              setExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
      
      {/* Day picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Day</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? expiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
          onChangeText={(text) => {
            const day = parseInt(text);
            if (!isNaN(day) && day >= 1 && day <= 31) {
              const newDate = new Date(expiry || new Date());
              newDate.setDate(day);
              setExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
    </View>
    
    <TouchableOpacity 
      style={styles.datePickerSaveButton}
      onPress={() => setShowDatePicker(false)}
    >
      <Text style={styles.datePickerSaveText}>Save</Text>
    </TouchableOpacity>
  </View>
      )}
      
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Voucher</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const GiftCardForm = ({
  title, setTitle,
  store, setStore,
  cardNumber, setCardNumber,
  pin, setPin,
  balance, setBalance,
  expiry, setExpiry,
  showDatePicker, setShowDatePicker,
  notes, setNotes,
  formatDate,
  onSave
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addContainer}
    >
      <Text style={styles.formTitle}>Add Gift Card</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Store"
        placeholderTextColor="#6b7280"
        value={store}
        onChangeText={setStore}
      />
      <TextInput
        style={styles.input}
        placeholder="Card Number"
        placeholderTextColor="#6b7280"
        value={cardNumber}
        onChangeText={setCardNumber}
      />
      
      <TextInput
        style={styles.input}
        placeholder="PIN (optional)"
        placeholderTextColor="#6b7280"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="numeric"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Balance (optional)"
        placeholderTextColor="#6b7280"
        value={balance}
        onChangeText={setBalance}
      />
      
      {/* Expiry Date Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: expiry ? '#fff' : '#6b7280' }}>
          {expiry ? formatDate(expiry) : 'Expiry Date (optional)'}
        </Text>
      </TouchableOpacity>
      
      {showDatePicker && (
  <View style={styles.datePickerContainer}>
    <View style={styles.datePickerHeader}>
      <Text style={styles.datePickerTitle}>Select Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
        <Text style={styles.datePickerCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
    
    <View style={styles.datePickerControls}>
      {/* Year picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Year</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? expiry.getFullYear().toString() : new Date().getFullYear().toString()}
          onChangeText={(text) => {
            const year = parseInt(text);
            if (!isNaN(year) && text.length === 4) {
              const newDate = new Date(expiry || new Date());
              newDate.setFullYear(year);
              setExpiry(newDate);
            }
          }}
          maxLength={4}
        />
      </View>
      
      {/* Month picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Month</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? (expiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
          onChangeText={(text) => {
            const month = parseInt(text);
            if (!isNaN(month) && month >= 1 && month <= 12) {
              const newDate = new Date(expiry || new Date());
              newDate.setMonth(month - 1);
              setExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
      
      {/* Day picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Day</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={expiry ? expiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
          onChangeText={(text) => {
            const day = parseInt(text);
            if (!isNaN(day) && day >= 1 && day <= 31) {
              const newDate = new Date(expiry || new Date());
              newDate.setDate(day);
              setExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
    </View>
    
    <TouchableOpacity 
      style={styles.datePickerSaveButton}
      onPress={() => setShowDatePicker(false)}
    >
      <Text style={styles.datePickerSaveText}>Save</Text>
    </TouchableOpacity>
  </View>
      )}
      
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Gift Card</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const AddressForm = ({
  title, setTitle,
  fullName, setFullName,
  street, setStreet,
  city, setCity,
  state, setState,
  zipCode, setZipCode,
  country, setCountry,
  phone, setPhone,
  email, setEmail,
  notes, setNotes,
  onSave
}) => {
  return (
    <ScrollView style={styles.addContainer}>
      <Text style={styles.formTitle}>Add Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#6b7280"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Street Address"
        placeholderTextColor="#6b7280"
        value={street}
        onChangeText={setStreet}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor="#6b7280"
        value={city}
        onChangeText={setCity}
      />
      <TextInput
        style={styles.input}
        placeholder="State/Province"
        placeholderTextColor="#6b7280"
        value={state}
        onChangeText={setState}
      />
      <TextInput
        style={styles.input}
        placeholder="ZIP/Postal Code"
        placeholderTextColor="#6b7280"
        value={zipCode}
        onChangeText={setZipCode}
      />
      <TextInput
        style={styles.input}
        placeholder="Country"
        placeholderTextColor="#6b7280"
        value={country}
        onChangeText={setCountry}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone Number (optional)"
        placeholderTextColor="#6b7280"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        placeholderTextColor="#6b7280"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Address</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const OtherForm = ({
  title, setTitle,
  customFields,
  onAddField,
  onRemoveField,
  onUpdateField,
  notes, setNotes,
  onSave
}) => {
  return (
    <ScrollView style={styles.addContainer}>
      <Text style={styles.formTitle}>Add Other Item</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#6b7280"
        value={title}
        onChangeText={setTitle}
      />
      
      <Text style={styles.sectionLabel}>Custom Fields</Text>
      {customFields.map((field, index) => (
        <View key={index} style={styles.customFieldContainer}>
          <View style={styles.customFieldRow}>
            <TextInput
              style={[styles.input, styles.customFieldInput]}
              placeholder="Label"
              placeholderTextColor="#6b7280"
              value={field.label}
              onChangeText={(text) => onUpdateField(index, 'label', text)}
            />
            <TextInput
              style={[styles.input, styles.customFieldInput]}
              placeholder="Value"
              placeholderTextColor="#6b7280"
              value={field.value}
              onChangeText={(text) => onUpdateField(index, 'value', text)}
              secureTextEntry={field.isSecret}
            />
          </View>
          <View style={styles.customFieldOptions}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Secret</Text>
              <Switch
                value={field.isSecret}
                onValueChange={(value) => onUpdateField(index, 'isSecret', value)}
                trackColor={{ false: "#3f3f46", true: "#4f46e5" }}
                thumbColor={field.isSecret ? "#ffffff" : "#9ca3af"}
              />
            </View>
            <TouchableOpacity
              style={styles.removeFieldButton}
              onPress={() => onRemoveField(index)}
            >
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      
      <TouchableOpacity
        style={styles.addFieldButton}
        onPress={onAddField}
      >
        <Plus size={18} color="#fff" />
        <Text style={styles.addFieldButtonText}>Add Custom Field</Text>
      </TouchableOpacity>
      
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor="#6b7280"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={onSave}
      >
        <Text style={styles.saveButtonText}>Save Item</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};


// Define the password categories
const PASSWORD_CATEGORIES = {
  LOGIN: 'login',
  SOCIAL: 'social',
  CARD: 'card',
  VOUCHER: 'voucher',
  GIFT_CARD: 'giftcard',
  ADDRESS: 'address',
  OTHER: 'other'
};

// Define card types for the Cards category
const CARD_TYPES = [
  'Credit Card',
  'Debit Card',
  'Prepaid Card',
  'Membership Card',
  'ID Card',
  'Other'
];

// Base password interface
interface BasePassword {
  id: string;
  title: string;
  category: string;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Type for Login passwords
interface LoginPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.LOGIN;
  loginUsername: string;
  password: string;
  website?: string;
}

// Type for Social Media passwords
interface SocialPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.SOCIAL;
  platform: string;
  loginUsername: string;
  password: string;
  profileUrl?: string;
}

// Type for Card details
interface CardPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.CARD;
  cardType: string;
  cardNumber: string;
  expiryDate: Date | string;
  cvv: string;
  cardholderName: string;
}

// Type for Voucher details
interface VoucherPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.VOUCHER;
  store: string;
  code: string;
  expiryDate?: Date | string;
  value?: string;
}

// Type for Gift Card details
interface GiftCardPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.GIFT_CARD;
  store: string;
  cardNumber: string;
  pin?: string;
  balance?: string;
  expiryDate?: Date | string;
}

// Type for Address details
interface AddressPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.ADDRESS;
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phoneNumber?: string;
  email?: string;
}

// Type for Other items
interface OtherPassword extends BasePassword {
  category: typeof PASSWORD_CATEGORIES.OTHER;
  customFields: { label: string; value: string; isSecret?: boolean }[];
}

// Union type for all password types
type Password = 
  | LoginPassword 
  | SocialPassword 
  | CardPassword 
  | VoucherPassword 
  | GiftCardPassword
  | AddressPassword
  | OtherPassword;

// Legacy password format for backward compatibility
interface LegacyPassword {
  id: string;
  title: string;
  password: string;
}

// Password with security features
interface HiddenPassword {
  id: string;
  title: string;
  password: string;
  hasCustomPassword?: boolean;
  passwordHash?: string;
  useBiometrics?: boolean;
  category?: string;
}

interface ShowPasswords {
  [key: string]: boolean;
}

const HIDDEN_ENABLED_KEY = 'HIDDEN_FEATURE_ENABLED';
const HIDDEN_KEYWORD_KEY = 'HIDDEN_KEYWORD';
const HIDDEN_PASSWORDS_KEY = 'HIDDEN_PASSWORDS';

function PasswordsTab() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(PASSWORD_CATEGORIES.LOGIN);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({});
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form states for different categories
  // Login form fields
  const [loginTitle, setLoginTitle] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginWebsite, setLoginWebsite] = useState('');
  const [loginNotes, setLoginNotes] = useState('');
  
  // Social Media form fields
  const [socialTitle, setSocialTitle] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('');
  const [socialUsername, setSocialUsername] = useState('');
  const [socialPassword, setSocialPassword] = useState('');
  const [socialProfileUrl, setSocialProfileUrl] = useState('');
  const [socialNotes, setSocialNotes] = useState('');
  
  // Card form fields
  const [cardTitle, setCardTitle] = useState('');
  const [cardType, setCardType] = useState(CARD_TYPES[0]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState(new Date());
  const [cardCVV, setCardCVV] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNotes, setCardNotes] = useState('');
  const [showCardTypeDropdown, setShowCardTypeDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Voucher form fields
  const [voucherTitle, setVoucherTitle] = useState('');
  const [voucherStore, setVoucherStore] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherExpiry, setVoucherExpiry] = useState(new Date());
  const [voucherValue, setVoucherValue] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [showVoucherDatePicker, setShowVoucherDatePicker] = useState(false);
  
  // Gift Card form fields
  const [giftCardTitle, setGiftCardTitle] = useState('');
  const [giftCardStore, setGiftCardStore] = useState('');
  const [giftCardNumber, setGiftCardNumber] = useState('');
  const [giftCardPin, setGiftCardPin] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState('');
  const [giftCardExpiry, setGiftCardExpiry] = useState(new Date());
  const [giftCardNotes, setGiftCardNotes] = useState('');
  const [showGiftCardDatePicker, setShowGiftCardDatePicker] = useState(false);
  
  // Address form fields
  const [addressTitle, setAddressTitle] = useState('');
  const [addressFullName, setAddressFullName] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZipCode, setAddressZipCode] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressEmail, setAddressEmail] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  
  // Other item form fields
  const [otherTitle, setOtherTitle] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const [otherCustomFields, setOtherCustomFields] = useState<{
    label: string;
    value: string;
    isSecret?: boolean;
  }[]>([{ label: '', value: '', isSecret: false }]);

  // Hidden passwords feature
  const [hiddenEnabled, setHiddenEnabled] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [hiddenKeyword, setHiddenKeyword] = useState('');
  const [newHiddenKeyword, setNewHiddenKeyword] = useState('');
  const [hiddenPasswords, setHiddenPasswords] = useState<HiddenPassword[]>([]);
  const [showHiddenAdd, setShowHiddenAdd] = useState(false);
  const [newHiddenTitle, setNewHiddenTitle] = useState('');
  const [newHiddenPassword, setNewHiddenPassword] = useState('');
  const [showHiddenPasswords, setShowHiddenPasswords] = useState<ShowPasswords>({});
  const [setupHidden, setSetupHidden] = useState(false);

  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [customPasswordForHidden, setCustomPasswordForHidden] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [selectedPasswordId, setSelectedPasswordId] = useState<string | null>(null);
  const [showPasswordSecurityModal, setShowPasswordSecurityModal] = useState(false);
  const [passwordAuthModal, setPasswordAuthModal] = useState(false);
  const [passwordToVerify, setPasswordToVerify] = useState('');
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);

  const [duressMode, setDuressMode] = useState(false);
  const [duressEnabled, setDuressEnabled] = useState(false);
  const [fakePasswords, setFakePasswords] = useState<Password[]>([]);
  const [volumeUpPressed, setVolumeUpPressed] = useState(false);
  const [volumeDownPressed, setVolumeDownPressed] = useState(false);
  const [buttonPressTime, setButtonPressTime] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);

// Then add this inside the useEffect block that checks biometrics (around line 367)
  useEffect(() => {
    const checkBiometrics = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsSupported(compatible && enrolled);
      
      // Also check if fingerprint is enabled in user settings
      const fpEnabled = await SecureStorage.get('FINGERPRINT_ENABLED');
      setFingerprintEnabled(fpEnabled === 'true');
    };
    
    checkBiometrics();
  }, []);
  
  const router = useRouter();

  // Check for biometrics capability
  useEffect(() => {
    const checkBiometrics = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsSupported(compatible && enrolled);
    };
    
    checkBiometrics();
  }, []);

  // Check if hidden feature is enabled on load
  useEffect(() => {
    const checkHiddenFeature = async () => {
      const enabled = await SecureStorage.get(HIDDEN_ENABLED_KEY);
      if (enabled === 'true') {
        setHiddenEnabled(true);
        const keyword = await SecureStorage.get(HIDDEN_KEYWORD_KEY);
        if (keyword) {
          setHiddenKeyword(keyword);
        }
        // Load hidden passwords
        loadHiddenPasswords();
      }
    };
    
    checkHiddenFeature();
    loadUsername();
  }, []);

  useEffect(() => {
    if (username) {
      loadPasswords();
    }
  }, [username]);

  const loadUsername = async () => {
    const storedUsername = await SecureStorage.get('USERNAME');
    setUsername(storedUsername);
  };

  useEffect(() => {
    if (passwords.length > 0) {
      const initialVisibility = passwords.reduce((acc, pwd) => {
        acc[pwd.id] = false;
        return acc;
      }, {} as ShowPasswords);
      setShowPasswords(initialVisibility);
    }
  }, [passwords]);

  // Setup hidden password visibility
  useEffect(() => {
    if (hiddenPasswords.length > 0) {
      const initialVisibility = hiddenPasswords.reduce((acc, pwd) => {
        acc[pwd.id] = false;
        return acc;
      }, {} as ShowPasswords);
      setShowHiddenPasswords(initialVisibility);
    }
  }, [hiddenPasswords]);

  useEffect(() => {
    const handleVolumeButton = (event: any) => {
      // Handler for volume up press
      if (event.eventType === 'volumeUp') {
        setVolumeUpPressed(true);
        if (volumeDownPressed && !buttonPressTime) {
          setButtonPressTime(Date.now());
        }
      }
      
      // Handler for volume down press
      if (event.eventType === 'volumeDown') {
        setVolumeDownPressed(true);
        if (volumeUpPressed && !buttonPressTime) {
          setButtonPressTime(Date.now());
        }
      }
      
      // Handler for volume button release
      if (event.eventType === 'volumeUpRelease') {
        setVolumeUpPressed(false);
        setButtonPressTime(null);
      }
      
      if (event.eventType === 'volumeDownRelease') {
        setVolumeDownPressed(false);
        setButtonPressTime(null);
      }
      
      return true;
    };
    
    // Add listener for volume buttons
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleVolumeButton);
    
    return () => subscription.remove();
  }, [volumeUpPressed, volumeDownPressed]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (volumeUpPressed && volumeDownPressed && buttonPressTime && duressEnabled) {
      timer = setInterval(() => {
        const currentTime = Date.now();
        const duration = currentTime - buttonPressTime;
        
        if (duration >= 5000) {
          // Toggle duress mode after 5 seconds of pressing both buttons
          setDuressMode(prev => {
            const newValue = !prev;
            
            // Provide haptic feedback as confirmation
            Haptics.notificationAsync(
              newValue 
                ? Haptics.NotificationFeedbackType.Success 
                : Haptics.NotificationFeedbackType.Warning
            );
            
            // Generate fake passwords if entering duress mode
            if (newValue && fakePasswords.length === 0) {
              setFakePasswords(generateFakePasswords());
            }
            
            return newValue;
          });
          
          // Reset timer
          setButtonPressTime(null);
          clearInterval(timer);
        }
      }, 100);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [volumeUpPressed, volumeDownPressed, buttonPressTime, duressEnabled, fakePasswords]);

  useEffect(() => {
    const loadDuressSettings = async () => {
      try {
        const duressEnabledSetting = await SecureStorage.get('DURESS_ENABLED');
        const duressActiveState = await SecureStorage.get('DURESS_MODE_ACTIVE');
        
        if (duressEnabledSetting === 'true') {
          setDuressEnabled(true);
          
          // Check if duress mode was activated on login screen
          if (duressActiveState === 'true') {
            console.log("Duress mode was activated on login screen");
            setDuressMode(true);
            // Pre-generate fake passwords since duress mode is active
            setFakePasswords(generateFakePasswords());
          } else {
            // Still pre-generate fake passwords for faster activation later
            setFakePasswords(generateFakePasswords());
          }
        }
      } catch (error) {
        console.error('Error loading duress settings:', error);
      }
    };
    
    loadDuressSettings();
  }, []);

  // Load hidden passwords from secure storage
  const loadHiddenPasswords = async () => {
    try {
      const storedPasswords = await SecureStorage.get(HIDDEN_PASSWORDS_KEY);
      if (storedPasswords) {
        const parsedPasswords = JSON.parse(storedPasswords) as HiddenPassword[];
        setHiddenPasswords(parsedPasswords);
      }
    } catch (error) {
      console.error('Error loading hidden passwords:', error);
    }
  };

  // Save hidden passwords to secure storage
  const saveHiddenPasswords = async (updatedPasswords: HiddenPassword[]) => {
    try {
      await SecureStorage.set(HIDDEN_PASSWORDS_KEY, JSON.stringify(updatedPasswords));
    } catch (error) {
      console.error('Error saving hidden passwords:', error);
      Alert.alert('Error', 'Failed to save hidden passwords');
    }
  };

  // Helper to format a date as yyyy-MM-dd
  const formatDate = (date: Date | undefined | string) => {
    if (!date) return '';
    
    if (typeof date === 'string') {
      // If it's already a string, check if it's a valid date format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date; // Already in yyyy-MM-dd format
      }
      // Try to parse the string to a Date
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return '';
      }
      date = parsedDate;
    }
    
    return format(date, 'yyyy-MM-dd');
  };

  const generateFakePasswords = () => {
    const commonServices = ['Gmail', 'Amazon', 'Netflix', 'Facebook', 'Twitter', 'Instagram', 'Dropbox', 'Microsoft'];
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];
    const cardIssuers = ['Visa', 'Mastercard', 'American Express', 'Discover'];
    const stores = ['Amazon', 'Walmart', 'Target', 'Best Buy', 'Apple Store'];
    const countries = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany'];
    
    const fakePwds: Password[] = [];
    
    // Generate fake logins (3-5)
    const loginCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < loginCount; i++) {
      const service = commonServices[Math.floor(Math.random() * commonServices.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const username = `user${Math.floor(Math.random() * 10000)}@${domain}`;
      fakePwds.push({
        id: `fake-login-${i}`,
        title: `${service} Account`,
        category: PASSWORD_CATEGORIES.LOGIN,
        loginUsername: username,
        password: `P@ssw0rd${Math.floor(Math.random() * 1000)}!`,
        website: `https://www.${service.toLowerCase()}.com`,
        notes: '',
        createdAt: new Date(Date.now() - Math.random() * 10000000).toISOString()
      } as LoginPassword);
    }
  
    const cardCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < cardCount; i++) {
      const issuer = cardIssuers[Math.floor(Math.random() * cardIssuers.length)];
      const cardNum = issuer === 'American Express' 
        ? `3${Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0')}`
        : `${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const expYear = new Date().getFullYear() + Math.floor(Math.random() * 5);
      const expMonth = Math.floor(Math.random() * 12) + 1;
      const expDay = Math.floor(Math.random() * 28) + 1;
      const expiry = new Date(expYear, expMonth, expDay);
      
      fakePwds.push({
        id: `fake-card-${i}`,
        title: `${issuer} ${Math.random() > 0.5 ? 'Credit' : 'Debit'} Card`,
        category: PASSWORD_CATEGORIES.CARD,
        cardType: issuer === 'American Express' ? 'Credit Card' : 
                 Math.random() > 0.5 ? 'Credit Card' : 'Debit Card',
        cardNumber: cardNum,
        expiryDate: formatDate(expiry),
        cvv: `${Math.floor(Math.random() * 900) + 100}`,
        cardholderName: 'John Doe',
        notes: ''
      } as CardPassword);
    }
    const giftCardCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < giftCardCount; i++) {
      const store = stores[Math.floor(Math.random() * stores.length)];
      fakePwds.push({
        id: `fake-gift-${i}`,
        title: `${store} Gift Card`,
        category: PASSWORD_CATEGORIES.GIFT_CARD,
        store: store,
        cardNumber: `${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        pin: `${Math.floor(Math.random() * 9000) + 1000}`,
        balance: `$${Math.floor(Math.random() * 100) + 5}.00`,
        notes: ''
      } as GiftCardPassword);
    }
    
    // Generate an address
    const country = countries[Math.floor(Math.random() * countries.length)];
    fakePwds.push({
      id: 'fake-address-1',
      title: 'Home Address',
      category: PASSWORD_CATEGORIES.ADDRESS,
      fullName: 'John Doe',
      streetAddress: `${Math.floor(Math.random() * 9000) + 1000} Main St`,
      city: 'Springfield',
      state: 'IL',
      zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: country,
      phoneNumber: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      email: `john.doe@${domains[Math.floor(Math.random() * domains.length)]}`,
      notes: ''
    } as AddressPassword);
    
    return fakePwds;
  };

  // Replace the existing handleSecretTap function (around line 1992)
const handleSecretTap = () => {
  const now = Date.now();
  
  // Reset counter if it's been more than 2 seconds since last tap
  if (now - lastTapTime > 2000) {
    setTapCount(1);
  } else {
    setTapCount(prev => prev + 1);
  }
  
  setLastTapTime(now);
  if (tapCount >= 4 && duressEnabled) {
    Haptics.notificationAsync(
      duressMode ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
    );
    
    // If we're in duress mode, attempt to deactivate with authentication
    if (duressMode) {
      deactivateDuressMode();
    } else {
      // Toggle duress mode on (activation only)
      const newDuressMode = true;
      setDuressMode(newDuressMode);
      
      // Update the secure storage with current duress mode state
      SecureStorage.set('DURESS_MODE_ACTIVE', 'true')
        .catch(err => console.error('Failed to update duress mode state:', err));
      
      // Generate fake passwords if entering duress mode
      if (fakePasswords.length === 0) {
        setFakePasswords(generateFakePasswords());
      }
    }
    
    // Reset counter
    setTapCount(0);
  }
};

  // Add this after the handleSecretTap function (around line 2003)
const deactivateDuressMode = async () => {
  try {
    // Check if we're currently in duress mode
    if (!duressMode) return;
    
    // Use alert with custom input handling based on platform
    if (Platform.OS === 'ios') {
      // iOS supports Alert.prompt natively
      Alert.prompt(
        'Security Check',  // Use a generic title to avoid revealing purpose
        'Please enter your password to continue',
        [
          {
            text: 'Cancel',
            onPress: () => console.log('Cancelled'),
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: (deactivationPassword) => verifyAndDeactivate(deactivationPassword),
          }
        ],
        'secure-text'
      );
    } else {
      // For Android: show a custom modal for password input
      Alert.alert(
        'Security Check',
        'Authentication required to continue',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: () => {
              // For Android, we need a custom password input
              // Since we can't show an input in Alert directly, use fingerprint if available
              if (fingerprintEnabled) {
                performBiometricCheck();
              } else {
                // In a real app, show a Modal with TextInput here
                Alert.alert(
                  'Enter Password',
                  'Please enter your master password:',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    },
                    {
                      text: 'Submit',
                      onPress: async () => {
                        // In a real implementation, you'd get input from a TextInput
                        // For now, use a direct API call to get the password
                        const storedPassword = await SecureStorage.get('PASSWORD');
                        verifyAndDeactivate(storedPassword);
                      }
                    }
                  ]
                );
              }
            }
          }
        ]
      );
    }
  } catch (error) {
    console.error('Error initiating duress mode deactivation:', error);
    Alert.alert('Operation Failed', 'Please try again later.');
  }
};

const verifyAndDeactivate = async (password) => {
  try {
    console.log("Verifying password for duress mode deactivation");
    const storedPassword = await SecureStorage.get('PASSWORD');
    
    if (password === storedPassword) {
      // If correct password, proceed with fingerprint check if enabled
      if (fingerprintEnabled) {
        performBiometricCheck();
      } else {
        // Password only verification completed successfully
        completeDeactivation();
      }
    } else {
      // Wrong password - show generic error after a delay
      console.log("Password verification failed");
      setTimeout(() => {
        Alert.alert('Authentication Failed', 'Please check your credentials and try again.');
      }, 1000);
    }
  } catch (error) {
    console.error('Error in password verification:', error);
    Alert.alert('Verification Failed', 'Please try again later.');
  }
};
  
const performBiometricCheck = async () => {
  try {
    console.log("Performing biometric check for duress deactivation");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use Passcode',
    });
    
    if (result.success) {
      console.log("Biometric authentication successful");
      completeDeactivation();
    } else {
      console.log('Biometric verification failed');
      Alert.alert('Authentication Failed', 'Biometric verification unsuccessful.');
    }
  } catch (error) {
    console.error('Error during biometric check:', error);
    Alert.alert('Biometric Check Failed', 'Please try again later.');
  }
};
  
const completeDeactivation = async () => {
  try {
    console.log("Completing duress mode deactivation");
    await SecureStorage.set('DURESS_MODE_ACTIVE', 'false');
    setDuressMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Subtly indicate success without explicitly mentioning duress mode
    Alert.alert('Security Update', 'Your security settings have been updated successfully.');
    
    // Reload passwords to show actual data
    loadPasswords();
  } catch (error) {
    console.error('Error completing deactivation:', error);
    Alert.alert('Update Failed', 'Could not update security settings.');
  }
};



  // Function to reset all form fields
  const resetAllFormFields = () => {
    // Login fields
    setLoginTitle('');
    setLoginUsername('');
    setLoginPassword('');
    setLoginWebsite('');
    setLoginNotes('');
    
    // Social fields
    setSocialTitle('');
    setSocialPlatform('');
    setSocialUsername('');
    setSocialPassword('');
    setSocialProfileUrl('');
    setSocialNotes('');
    
    // Card fields
    setCardTitle('');
    setCardType(CARD_TYPES[0]);
    setCardNumber('');
    setCardExpiry(new Date());
    setCardCVV('');
    setCardholderName('');
    setCardNotes('');
    
    // Voucher fields
    setVoucherTitle('');
    setVoucherStore('');
    setVoucherCode('');
    setVoucherExpiry(new Date());
    setVoucherValue('');
    setVoucherNotes('');
    
    // Gift Card fields
    setGiftCardTitle('');
    setGiftCardStore('');
    setGiftCardNumber('');
    setGiftCardPin('');
    setGiftCardBalance('');
    setGiftCardExpiry(new Date());
    setGiftCardNotes('');
    
    // Address fields
    setAddressTitle('');
    setAddressFullName('');
    setAddressStreet('');
    setAddressCity('');
    setAddressState('');
    setAddressZipCode('');
    setAddressCountry('');
    setAddressPhone('');
    setAddressEmail('');
    setAddressNotes('');
    
    // Other fields
        // Other fields
        setOtherTitle('');
        setOtherNotes('');
        setOtherCustomFields([{ label: '', value: '', isSecret: false }]);
      };
      
      // Enable hidden feature and set keyword
      const enableHiddenFeature = async () => {
        if (!newHiddenKeyword) {
          Alert.alert('Error', 'Please enter a keyword');
          return;
        }
    
        try {
          await SecureStorage.set(HIDDEN_ENABLED_KEY, 'true');
          await SecureStorage.set(HIDDEN_KEYWORD_KEY, newHiddenKeyword);
          setHiddenEnabled(true);
          setHiddenKeyword(newHiddenKeyword);
          setNewHiddenKeyword('');
          setSetupHidden(false);
          setShowHiddenModal(true);
          
          // Initialize empty hidden passwords array
          await saveHiddenPasswords([]);
          
          Alert.alert('Success', 'Hidden passwords feature enabled');
        } catch (error) {
          console.error('Error enabling hidden feature:', error);
          Alert.alert('Error', 'Failed to enable hidden feature');
        }
      };
    
      // Add a new hidden password
      const addHiddenPassword = () => {
        if (!newHiddenTitle || !newHiddenPassword) {
          return;
        }
    
        const newHiddenPwd: HiddenPassword = {
          id: Date.now().toString(),
          title: newHiddenTitle,
          password: newHiddenPassword,
          hasCustomPassword: useCustomPassword,
          passwordHash: useCustomPassword ? 
            EncryptionService.hashString(customPasswordForHidden) : undefined,
          useBiometrics: useBiometrics,
          category: activeCategory
        };
    
        const updatedPasswords = [...hiddenPasswords, newHiddenPwd];
        setHiddenPasswords(updatedPasswords);
        saveHiddenPasswords(updatedPasswords);
        
        // Reset form
        setNewHiddenTitle('');
        setNewHiddenPassword('');
        setUseCustomPassword(false);
        setCustomPasswordForHidden('');
        setUseBiometrics(false);
        setShowHiddenAdd(false);
      };
    
      const handleViewSecuredPassword = async (id: string) => {
        const password = hiddenPasswords.find(pwd => pwd.id === id);
        
        if (!password) return;
        
        let biometricsAuthenticated = false;
        
        // If biometric protection is enabled
        if (password.useBiometrics) {
          try {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: `Unlock "${password.title}"`,
              // If only biometrics is enabled (no password), we should disable device fallback
              disableDeviceFallback: !password.hasCustomPassword,
              cancelLabel: 'Cancel'
            });
            
            if (result.success) {
              biometricsAuthenticated = true;
              
              // If only biometrics is required (no password), show the password
              if (!password.hasCustomPassword) {
                setShowHiddenPasswords(prev => ({
                  ...prev,
                  [id]: !prev[id]
                }));
                return;
              }
              // Otherwise we need to continue to password verification if that's also enabled
            } else if (!password.hasCustomPassword) {
              // Biometric failed and it's the only security method
              return;
            }
            // If biometric fails but we also have password auth, we'll proceed to password check
          } catch (error) {
            console.error('Error using biometrics:', error);
            // If only biometrics, don't proceed further
            if (!password.hasCustomPassword) return;
          }
        }
        
        // If it has a custom password
        if (password.hasCustomPassword) {
          setSelectedPasswordId(id);
          setPasswordToVerify('');
          // Store if biometric was already authenticated
          setBiometricAuthenticated(biometricsAuthenticated);
          setPasswordAuthModal(true);
        } else {
          // If no security, just toggle visibility
          toggleHiddenPasswordVisibility(id);
        }
      };
    
      const verifyCustomPassword = () => {
        if (!selectedPasswordId) return;
        
        const password = hiddenPasswords.find(pwd => pwd.id === selectedPasswordId);
        if (!password || !password.passwordHash) return;
        
        const hashedInput = EncryptionService.hashString(passwordToVerify);
        
        if (hashedInput === password.passwordHash) {
          // If both auth methods required, check if biometric was already authenticated
          if (password.useBiometrics && !biometricAuthenticated) {
            Alert.alert(
              'Biometric Authentication Required', 
              'This password requires both password and biometric authentication.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    try {
                      const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: `Verify biometrics for "${password.title}"`,
                        disableDeviceFallback: true,
                      });
                      
                      if (result.success) {
                        toggleHiddenPasswordVisibility(selectedPasswordId);
                        setPasswordAuthModal(false);
                        setPasswordToVerify('');
                        setSelectedPasswordId(null);
                        setBiometricAuthenticated(false);
                      }
                    } catch (error) {
                      console.error('Biometric verification error:', error);
                    }
                  }
                }
              ]
            );
          } else {
            // If only password auth or biometric already done
            toggleHiddenPasswordVisibility(selectedPasswordId);
            setPasswordAuthModal(false);
            setPasswordToVerify('');
            setSelectedPasswordId(null);
            setBiometricAuthenticated(false);
          }
        } else {
          Alert.alert('Error', 'Incorrect password');
        }
      };
    
      // Toggle hidden password visibility
      const toggleHiddenPasswordVisibility = (id: string): void => {
        setShowHiddenPasswords(prev => ({
          ...prev,
          [id]: !prev[id]
        }));
      };
    
      const openSecuritySettings = (id: string) => {
        const password = hiddenPasswords.find(pwd => pwd.id === id);
        if (!password) return;
        
        setSelectedPasswordId(id);
        setUseCustomPassword(!!password.hasCustomPassword);
        setUseBiometrics(!!password.useBiometrics);
        setCustomPasswordForHidden('');
        setShowPasswordSecurityModal(true);
      };
    
      // Save security settings for a password
      const saveSecuritySettings = () => {
        if (!selectedPasswordId) return;
        
        const updatedPasswords = hiddenPasswords.map(pwd => {
          if (pwd.id === selectedPasswordId) {
            return {
              ...pwd,
              hasCustomPassword: useCustomPassword,
              passwordHash: useCustomPassword && customPasswordForHidden ? 
                EncryptionService.hashString(customPasswordForHidden) : pwd.passwordHash,
              useBiometrics
            };
          }
          return pwd;
        });
        
        setHiddenPasswords(updatedPasswords);
        saveHiddenPasswords(updatedPasswords);
        setShowPasswordSecurityModal(false);
        setSelectedPasswordId(null);
      };
    
      // Delete a hidden password
      const deleteHiddenPassword = (id: string) => {
        Alert.alert(
          'Delete Hidden Password',
          'Are you sure you want to delete this password?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                const updatedPasswords = hiddenPasswords.filter(pwd => pwd.id !== id);
                setHiddenPasswords(updatedPasswords);
                saveHiddenPasswords(updatedPasswords);
              }
            }
          ]
        );
      };
    
      // Delete all hidden passwords
      const deleteAllHiddenPasswords = () => {
        Alert.alert(
          'Delete All Hidden Passwords',
          'Are you sure you want to delete all hidden passwords? This action cannot be undone.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Delete All',
              style: 'destructive',
              onPress: async () => {
                setHiddenPasswords([]);
                await saveHiddenPasswords([]);
              }
            }
          ]
        );
      };
    
      // Handle adding custom fields for Other category
      const handleAddCustomField = () => {
        setOtherCustomFields([...otherCustomFields, { label: '', value: '', isSecret: false }]);
      };
    
      const handleRemoveCustomField = (index: number) => {
        if (otherCustomFields.length <= 1) {
          return; // Keep at least one field
        }
        const updatedFields = [...otherCustomFields];
        updatedFields.splice(index, 1);
        setOtherCustomFields(updatedFields);
      };
    
      const updateCustomField = (index: number, field: 'label' | 'value' | 'isSecret', value: string | boolean) => {
        const updatedFields = [...otherCustomFields];
        updatedFields[index] = { ...updatedFields[index], [field]: value };
        setOtherCustomFields(updatedFields);
      };
    
      // Handle adding a new password for any category
      const handleAddPassword = async () => {
        // Check for system keyword triggers
        if (activeCategory === PASSWORD_CATEGORIES.LOGIN && loginTitle.toLowerCase() === 'reset') {
          Alert.alert(
            'Reset All Data',
            'Are you sure you want to reset all passwords and hidden password settings? This action cannot be undone.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoginTitle('');
                }
              },
              {
                text: 'Reset Everything',
                style: 'destructive',
                onPress: async () => {
                  setIsLoading(true);
                  try {
                    // Reset hidden passwords feature
                    await SecureStorage.set(HIDDEN_ENABLED_KEY, 'false');
                    await SecureStorage.set(HIDDEN_KEYWORD_KEY, '');
                    await SecureStorage.set(HIDDEN_PASSWORDS_KEY, '[]');
                    
                    setHiddenEnabled(false);
                    setHiddenKeyword('');
                    setHiddenPasswords([]);
                    
                    // Reset regular passwords (this is just local - if you want to delete from server,
                    // you would need additional API calls)
                    const authToken = await SecureStorage.get('AUTH_TOKEN');
                    
                    if (authToken) {
                      // Optional: Add an API call here to delete all passwords from the server
                      // For now, we'll just clear the local state
                      setPasswords([]);
                    }
                    resetAllFormFields();
                    setShowAdd(false);
                    
                    Alert.alert('Reset Complete', 'All password data has been reset.');
                  } catch (error) {
                    console.error('Error during reset:', error);
                    Alert.alert('Error', 'Failed to complete the reset process.');
                  } finally {
                    setIsLoading(false);
                  }
                }
              }
            ]
          );
          
          return;
        }
        if (activeCategory === PASSWORD_CATEGORIES.LOGIN && loginTitle.toLowerCase() === 'enableduress') {
          Alert.alert(
            'Enable Duress Mode',
            'Duress mode lets you show fake data under coercion. To activate it when needed, tap 5 times quickly on the title at the top of the screen. Do you want to enable this feature?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoginTitle('');
                }
              },
              {
                text: 'Enable',
                style: 'default',
                onPress: async () => {
                  try {
                    await SecureStorage.set('DURESS_ENABLED', 'true');
                    setDuressEnabled(true);
                    setFakePasswords(generateFakePasswords());
                    setLoginTitle('');
                    Alert.alert(
                      'Duress Mode Enabled', 
                      'Tap 5 times quickly on the title at the top of the screen to toggle duress mode when needed.'
                    );
                  } catch (error) {
                    console.error('Error enabling duress mode:', error);
                    Alert.alert('Error', 'Failed to enable duress mode');
                  }
                }
              }
            ]
          );
          return;
        }

        if (activeCategory === PASSWORD_CATEGORIES.LOGIN && loginTitle.toLowerCase() === 'disableduress') {
          Alert.alert(
            'Disable Duress Mode',
            'Are you sure you want to disable duress mode?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoginTitle('');
                }
              },
              {
                text: 'Disable',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await SecureStorage.set('DURESS_ENABLED', 'false');
                    setDuressEnabled(false);
                    setDuressMode(false);
                    setFakePasswords([]);
                    setLoginTitle('');
                    Alert.alert('Duress Mode Disabled');
                  } catch (error) {
                    console.error('Error disabling duress mode:', error);
                    Alert.alert('Error', 'Failed to disable duress mode');
                  }
                }
              }
            ]
          );
          return;
        }

        if (duressMode && duressEnabled) {
          setIsLoading(true);
          
          // Simulate delay to make it look real
          setTimeout(() => {
            setIsLoading(false);
            resetAllFormFields();
            setShowAdd(false);
            
            // Generate a new fake password to add to the list
            const newPassword = generateFakePasswords()[0];
            setFakePasswords(prev => [...prev, newPassword]);
            
            Alert.alert('Success', `${newPassword.title} has been saved successfully`);
          }, 1500);
          return;
        }
        
        // Check for hidden feature activation
        if (activeCategory === PASSWORD_CATEGORIES.LOGIN && loginTitle.toLowerCase() === 'lock' && !loginPassword && !hiddenEnabled) {
          setLoginTitle('');
          setSetupHidden(true);
          return;
        }
        
        // Check for keyword to open hidden passwords
        if (hiddenEnabled && 
            ((activeCategory === PASSWORD_CATEGORIES.LOGIN && loginTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.SOCIAL && socialTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.CARD && cardTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.VOUCHER && voucherTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.GIFT_CARD && giftCardTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.ADDRESS && addressTitle === hiddenKeyword) ||
             (activeCategory === PASSWORD_CATEGORIES.OTHER && otherTitle === hiddenKeyword))) {
          resetAllFormFields();
          setShowHiddenModal(true);
          return;
        }
        
        // Regular password addition based on category
        await addPassword();
      };
    
      // Load passwords from server
      const loadPasswords = async () => {
        try {
          setIsLoading(true);
          const privateKey = await SecureStorage.get('PRIVATE_KEY');
          const authToken = await SecureStorage.get('AUTH_TOKEN');
          
          if (!authToken) {
            throw new Error('No auth token found');
          }
      
          if (!privateKey) {
            throw new Error('No private key found');
          }
      
          const response = await axios.get(
            'http://192.168.179.248:5000/api/users/passwords',
            {
              params: { privateKey, username },
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
      
          // Process the passwords
          let processedPasswords: Password[] = [];
          
          for (const pwd of response.data) {
            // Step 1: Try to decrypt if necessary
            let decryptedData = pwd;
            
            // Step 2: Ensure category is properly set and normalized
            if (!decryptedData.category) {
              // This is a legacy password, convert to LOGIN type
              processedPasswords.push({
                id: decryptedData.id,
                title: decryptedData.title,
                category: PASSWORD_CATEGORIES.LOGIN,
                loginUsername: decryptedData.loginUsername || '',
                password: decryptedData.password,
                website: decryptedData.website || '',
                notes: decryptedData.notes || '',
                createdAt: decryptedData.createdAt || new Date().toISOString(),
                updatedAt: decryptedData.updatedAt || new Date().toISOString(),
              });
            } else {
              // Normalize the category to match PASSWORD_CATEGORIES constants
              let category = decryptedData.category.toLowerCase();
              
              // Convert category to one of our defined constants
              switch(category) {
                case 'login':
                  category = PASSWORD_CATEGORIES.LOGIN;
                  break;
                case 'social':
                case 'socialmedia':
                  category = PASSWORD_CATEGORIES.SOCIAL;
                  break;
                case 'card':
                case 'cards':
                case 'creditcard':
                  category = PASSWORD_CATEGORIES.CARD;
                  break;
                case 'voucher':
                case 'vouchers':
                  category = PASSWORD_CATEGORIES.VOUCHER;
                  break;
                case 'giftcard':
                case 'gift_card':
                case 'gift':
                  category = PASSWORD_CATEGORIES.GIFT_CARD;
                  break;
                case 'address':
                case 'addresses':
                  category = PASSWORD_CATEGORIES.ADDRESS;
                  break;
                  // In the loadPasswords function, modify the part that handles OTHER category
// (around line 1090-1110)

                case PASSWORD_CATEGORIES.OTHER:
                case 'others':
                    category = PASSWORD_CATEGORIES.OTHER;
                    
                    // Normalize customFields to ensure consistent format
                    if (decryptedData.customFields === null || decryptedData.customFields === undefined) {
                      decryptedData.customFields = [];
                    } else if (typeof decryptedData.customFields === 'string') {
                      try {
                        // Try to parse if it's a JSON string
                        decryptedData.customFields = JSON.parse(decryptedData.customFields);
                      } catch (e) {
                        console.error('Error parsing customFields:', e);
                        decryptedData.customFields = [];
                      }
                    } 
                    
                    // Make sure each field has the required properties
                    if (Array.isArray(decryptedData.customFields)) {
                      decryptedData.customFields = decryptedData.customFields.map(field => ({
                        label: field.label || '',
                        value: field.value || '',
                        isSecret: !!field.isSecret
                      }));
                    } else {
                      decryptedData.customFields = [];
                    }
                    break;
                default:
                  category = PASSWORD_CATEGORIES.LOGIN; // Default
              }
              
              // Add with normalized category
              processedPasswords.push({
                ...decryptedData,
                category: category
              } as Password);
            }
            setPasswords(processedPasswords);
            }
        } catch (error) {
          console.error('Error loading passwords:', error);
          if (error.response?.status === 401 || error.response?.status === 403) {
            Alert.alert('Session Expired', 'Please login again');
            router.replace('/');
          } else {
            Alert.alert('Error', 'Failed to load passwords. Please try again.');
          }
        } finally {
          setIsLoading(false);
        }
      };
    
      useEffect(() => {
        loadUsername();
        
          // Check if passwords were recently updated
    const checkUpdatedFlag = async () => {
      const updated = await SecureStorage.get('PASSWORDS_UPDATED');
      if (updated === 'true') {
        // Clear the flag and reload passwords
        await SecureStorage.set('PASSWORDS_UPDATED', 'false');
        if (username) {
          loadPasswords();
        }
      }
    };
    
    checkUpdatedFlag();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    
    try {
      await loadPasswords();
      // Clear the PASSWORDS_UPDATED flag since we just refreshed
      await SecureStorage.set('PASSWORDS_UPDATED', 'false');
    } catch (error) {
      console.error('Error refreshing passwords:', error);
    } finally {
      setRefreshing(false);
    }
  }, [username]);

  // Main function to add passwords based on active category
  const addPassword = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const privateKey = await SecureStorage.get('PRIVATE_KEY');
      const authToken = await SecureStorage.get('AUTH_TOKEN');

      if (!authToken) {
        throw new Error('No auth token found');
      }
      
      if (!username) {
        throw new Error('No username found');
      }

      // Prepare password data based on active category
      let newPassword: Partial<Password> | null = null;
      
      switch (activeCategory) {
        case PASSWORD_CATEGORIES.LOGIN:
          if (!loginTitle || !loginPassword) {
            Alert.alert('Error', 'Title and password are required');
            return;
          }
          newPassword = {
            title: loginTitle,
            category: PASSWORD_CATEGORIES.LOGIN,
            loginUsername: loginUsername,
            password: loginPassword,
            website: loginWebsite,
            notes: loginNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.SOCIAL:
          if (!socialTitle || !socialUsername || !socialPassword) {
            Alert.alert('Error', 'Title, username, and password are required');
            return;
          }
          newPassword = {
            title: socialTitle,
            category: PASSWORD_CATEGORIES.SOCIAL,
            platform: socialPlatform,
            loginUsername: socialUsername,
            password: socialPassword,
            profileUrl: socialProfileUrl,
            notes: socialNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.CARD:
          if (!cardTitle || !cardNumber || !cardholderName) {
            Alert.alert('Error', 'Title, card number, and cardholder name are required');
            return;
          }
          newPassword = {
            title: cardTitle,
            category: PASSWORD_CATEGORIES.CARD,
            cardType: cardType,
            cardNumber: cardNumber,
            expiryDate: formatDate(cardExpiry),
            cvv: cardCVV,
            cardholderName: cardholderName,
            notes: cardNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.VOUCHER:
          if (!voucherTitle || !voucherStore || !voucherCode) {
            Alert.alert('Error', 'Title, store, and code are required');
            return;
          }
          newPassword = {
            title: voucherTitle,
            category: PASSWORD_CATEGORIES.VOUCHER,
            store: voucherStore,
            code: voucherCode,
            expiryDate: formatDate(voucherExpiry),
            value: voucherValue,
            notes: voucherNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.GIFT_CARD:
          if (!giftCardTitle || !giftCardStore || !giftCardNumber) {
            Alert.alert('Error', 'Title, store, and card number are required');
            return;
          }
          newPassword = {
            title: giftCardTitle,
            category: PASSWORD_CATEGORIES.GIFT_CARD,
            store: giftCardStore,
            cardNumber: giftCardNumber,
            pin: giftCardPin,
            balance: giftCardBalance,
            expiryDate: formatDate(giftCardExpiry),
            notes: giftCardNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.ADDRESS:
          if (!addressTitle || !addressFullName || !addressStreet || !addressCity || 
              !addressState || !addressZipCode || !addressCountry) {
            Alert.alert('Error', 'Title, full name, and complete address are required');
            return;
          }
          newPassword = {
            title: addressTitle,
            category: PASSWORD_CATEGORIES.ADDRESS,
            fullName: addressFullName,
            streetAddress: addressStreet,
            city: addressCity,
            state: addressState,
            zipCode: addressZipCode,
            country: addressCountry,
            phoneNumber: addressPhone,
            email: addressEmail,
            notes: addressNotes,
          };
          break;
          
        case PASSWORD_CATEGORIES.OTHER:
          if (!otherTitle) {
            Alert.alert('Error', 'Title is required');
            return;
          }
          
          // Validate custom fields
          const validCustomFields = otherCustomFields.filter(
            field => field.label.trim() !== '' && field.value.trim() !== ''
          );
          
          if (validCustomFields.length === 0) {
            Alert.alert('Error', 'At least one custom field with label and value is required');
            return;
          }
          
          newPassword = {
            title: otherTitle,
            category: PASSWORD_CATEGORIES.OTHER,
            customFields: validCustomFields,
            notes: otherNotes,
          };
          break;
      }

      // Make the API call to save the new password
      if (newPassword) {
        const response = await axios.post(
          'http://192.168.179.248:5000/api/users/add-password',
          {
            username,
            ...newPassword,
            privateKey,
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.status === 201) {
          // Refresh password list
          await loadPasswords();
          
          // Clear form
          resetAllFormFields();
          setShowAdd(false);
          
          Alert.alert('Success', `${newPassword.title} has been saved successfully`);
        }
      }
    } catch (error) {
      console.error('Error saving password:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        router.replace('/');
      } else {
        Alert.alert('Error', 'Failed to save password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (id: string): void => {
    // In duress mode, use a separate visibility state
    if (duressMode && duressEnabled) {
      const fakeShowPasswords = { ...showPasswords };
      fakeShowPasswords[id] = !fakeShowPasswords[id];
      setShowPasswords(fakeShowPasswords);
      return;
    }
    
    // Original code
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const deletePassword = async (id: string) => {
    try {
      if (duressMode && duressEnabled) {
        Alert.alert(
          'Delete Item',
          'Are you sure you want to delete this item?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                setIsLoading(true);
                
                // Simulate delay and remove from fake passwords
                setTimeout(() => {
                  setFakePasswords(prev => prev.filter(p => p.id !== id));
                  setIsLoading(false);
                }, 800);
              }
            }
          ]
        );
        return;
      }
      const authToken = await SecureStorage.get('AUTH_TOKEN');
  
      if (!authToken) {
        throw new Error('No auth token found');
      }
  
      // Show confirmation dialog
      Alert.alert(
        'Delete Item',
        'Are you sure you want to delete this item?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsLoading(true);
              try {
                await axios.delete(
                  `http://192.168.179.248:5000/api/users/passwords/${id}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                // Remove password from state
                setPasswords(prevPasswords => 
                  prevPasswords.filter(pwd => pwd.id !== id)
                );
              } catch (error) {
                console.error('Error deleting password:', error);
                if (error.response?.status === 401) {
                  Alert.alert('Session Expired', 'Please login again');
                  router.replace('/');
                } else {
                  Alert.alert('Error', 'Failed to delete item. Please try again.');
                }
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error initiating password deletion:', error);
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  };

  const getIconForCategory = (category: string) => {
    switch (category) {
      case PASSWORD_CATEGORIES.LOGIN:
        return <Key size={20} color="#4F46E5" />;
      case PASSWORD_CATEGORIES.SOCIAL:
        return <Share2 size={20} color="#8b5cf6" />;
      case PASSWORD_CATEGORIES.CARD:
        return <CreditCard size={20} color="#ec4899" />;
      case PASSWORD_CATEGORIES.VOUCHER:
        return <Tag size={20} color="#f59e0b" />;
      case PASSWORD_CATEGORIES.GIFT_CARD:
        return <Gift size={20} color="#10b981" />;
      case PASSWORD_CATEGORIES.ADDRESS:
        return <MapPin size={20} color="#0ea5e9" />;
      case PASSWORD_CATEGORIES.OTHER:
        return <FileText size={20} color="#64748b" />;
      default:
        return <Lock size={20} color="#6b7280" />;
    }
  };

  // Helper function to extract website name from URL
  const extractWebsiteName = (url: string): string => {
    try {
      if (!url) return '';
      
      // Add protocol if missing
      let processedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        processedUrl = 'https://' + url;
      }
      
      const urlObj = new URL(processedUrl);
      // Extract hostname and remove 'www.' if present
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      // Extract the domain name (e.g., 'example.com' from 'subdomain.example.com')
      const parts = hostname.split('.');
      if (parts.length > 2) {
        // For domains like subdomain.example.com, return example.com
        return parts.slice(-2).join('.');
      }
      
      return hostname;
    } catch (e) {
      // If URL parsing fails, return the original string or a fallback
      return url.replace(/(https?:\/\/)?(www\.)?/i, '').split('/')[0];
    }
  };

  // Render password item based on its category
  const renderItem: ListRenderItem<Password> = ({ item }) => {
    // Common header for all password types
    const renderHeader = () => (
      <View style={styles.passwordHeader}>
        {getIconForCategory(item.category)}
        <Text style={styles.passwordTitle}>{item.title}</Text>
      </View>
    );

    // Render fields based on category
    const renderContent = () => {
      switch (item.category) {
        case PASSWORD_CATEGORIES.LOGIN:
          const loginItem = item as LoginPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Username:</Text>
                <Text style={styles.fieldValue}>{loginItem.loginUsername}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Password:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] ? loginItem.password : '•'.repeat(Math.min(loginItem.password.length, 12))}
                </Text>
              </View>
              {loginItem.website && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Website:</Text>
                  <TouchableOpacity 
                    style={styles.websiteLink}
                    onPress={() => {
                      // Try to open URL with added protocol if needed
                      let url = loginItem.website;
                      if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                      }
                      Linking.openURL(url).catch(err => 
                        Alert.alert('Error', 'Could not open website')
                      );
                    }}
                  >
                    <Text style={styles.websiteLinkText}>
                      {extractWebsiteName(loginItem.website)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          );
          
        case PASSWORD_CATEGORIES.SOCIAL:
          const socialItem = item as SocialPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Platform:</Text>
                <Text style={styles.fieldValue}>{socialItem.platform}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Username:</Text>
                <Text style={styles.fieldValue}>{socialItem.loginUsername}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Password:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] ? socialItem.password : '•'.repeat(Math.min(socialItem.password.length, 12))}
                </Text>
              </View>
              {socialItem.profileUrl && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Profile URL:</Text>
                  <Text style={styles.fieldValue}>{socialItem.profileUrl}</Text>
                </View>
              )}
            </>
          );
          
        case PASSWORD_CATEGORIES.CARD:
          const cardItem = item as CardPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Card Type:</Text>
                <Text style={styles.fieldValue}>{cardItem.cardType}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Card Number:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] 
                    ? cardItem.cardNumber 
                    : cardItem.cardNumber.substring(0, 4) + ' •••• •••• ' + 
                      cardItem.cardNumber.substring(cardItem.cardNumber.length - 4)}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Cardholder:</Text>
                <Text style={styles.fieldValue}>{cardItem.cardholderName}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Expiry:</Text>
                <Text style={styles.fieldValue}>{formatDate(cardItem.expiryDate)}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>CVV:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] ? cardItem.cvv : '•••'}
                </Text>
              </View>
            </>
          );
          
        case PASSWORD_CATEGORIES.VOUCHER:
          const voucherItem = item as VoucherPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Store:</Text>
                <Text style={styles.fieldValue}>{voucherItem.store}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Code:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] ? voucherItem.code : '•'.repeat(Math.min(voucherItem.code.length, 12))}
                </Text>
              </View>
              {voucherItem.value && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Value:</Text>
                  <Text style={styles.fieldValue}>{voucherItem.value}</Text>
                </View>
              )}
              {voucherItem.expiryDate && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Expiry:</Text>
                  <Text style={styles.fieldValue}>{formatDate(voucherItem.expiryDate)}</Text>
                </View>
              )}
            </>
          );
          
        case PASSWORD_CATEGORIES.GIFT_CARD:
          const giftCardItem = item as GiftCardPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Store:</Text>
                <Text style={styles.fieldValue}>{giftCardItem.store}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Card Number:</Text>
                <Text style={styles.fieldValue}>
                  {showPasswords[item.id] ? giftCardItem.cardNumber : '•'.repeat(Math.min(giftCardItem.cardNumber.length, 12))}
                  </Text>
              </View>
              {giftCardItem.pin && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>PIN:</Text>
                  <Text style={styles.fieldValue}>
                    {showPasswords[item.id] ? giftCardItem.pin : '•'.repeat(Math.min(giftCardItem.pin.length, 6))}
                  </Text>
                </View>
              )}
              {giftCardItem.balance && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Balance:</Text>
                  <Text style={styles.fieldValue}>{giftCardItem.balance}</Text>
                </View>
              )}
              {giftCardItem.expiryDate && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Expiry:</Text>
                  <Text style={styles.fieldValue}>{formatDate(giftCardItem.expiryDate)}</Text>
                </View>
              )}
            </>
          );
          
        case PASSWORD_CATEGORIES.ADDRESS:
          const addressItem = item as AddressPassword;
          return (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Full Name:</Text>
                <Text style={styles.fieldValue}>{addressItem.fullName}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Street:</Text>
                <Text style={styles.fieldValue}>{addressItem.streetAddress}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>City:</Text>
                <Text style={styles.fieldValue}>{addressItem.city}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>State:</Text>
                <Text style={styles.fieldValue}>{addressItem.state}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>ZIP:</Text>
                <Text style={styles.fieldValue}>{addressItem.zipCode}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Country:</Text>
                <Text style={styles.fieldValue}>{addressItem.country}</Text>
              </View>
              {addressItem.phoneNumber && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Phone:</Text>
                  <Text style={styles.fieldValue}>{addressItem.phoneNumber}</Text>
                </View>
              )}
              {addressItem.email && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Email:</Text>
                  <Text style={styles.fieldValue}>{addressItem.email}</Text>
                </View>
              )}
            </>
          );
          
        // Inside renderContent function, find the case for PASSWORD_CATEGORIES.OTHER (around line 3827)
        // Replace the existing OTHER case with:

        // Inside the renderContent function of the renderItem component (around line 3827)
// Replace the existing OTHER case with this updated code:

        // Inside the renderContent function of the renderItem component
// Replace the existing OTHER case with this corrected implementation:

        case PASSWORD_CATEGORIES.OTHER:
          const otherItem = item as OtherPassword;
          // Debug the structure of customFields
          // console.log('Custom Fields:', JSON.stringify(otherItem.customFields));
          
          return (
            <>
              {Array.isArray(otherItem.customFields) ? (
                otherItem.customFields.map((field, index) => {
                  // Ensure field has valid properties
                  if (!field) return null;
                  
                  // Make sure we have a label and value
                  const displayLabel = field.label || `Field ${index+1}`;
                  const fieldValue = field.value || '';
                  const isSecret = !!field.isSecret;
                  
                  return (
                    <View key={index} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{displayLabel}:</Text>
                      <Text style={styles.fieldValue}>
                        {isSecret && !showPasswords[item.id] ? 
                          '•'.repeat(Math.min(fieldValue.length || 4, 12)) : 
                          fieldValue}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Error:</Text>
                  <Text style={styles.fieldValue}>Custom fields not available</Text>
                </View>
              )}
            </>
          );
          
        default:
          // Fallback for unknown types - display as simple title/password
          return (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Content:</Text>
              <Text style={styles.fieldValue}>
                {showPasswords[item.id] ? 'Content hidden for security' : '•••••••••••••••'}
              </Text>
            </View>
          );
      }
    };
    
    // Notes section if available
    const renderNotes = () => {
      if (item.notes && item.notes.trim().length > 0) {
        return (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        );
      }
      return null;
    };
    
    // Actions for the password item
    const renderActions = () => {
      // Determine if this item has sensitive data that should be toggleable
      const hasToggleableContent = (): boolean => {
        switch (item.category) {
          case PASSWORD_CATEGORIES.LOGIN:
            return true; // Has password
          case PASSWORD_CATEGORIES.SOCIAL:
            return true; // Has password
          case PASSWORD_CATEGORIES.CARD:
            return true; // Has card number, CVV
          case PASSWORD_CATEGORIES.VOUCHER:
            return true; // Has code
          case PASSWORD_CATEGORIES.GIFT_CARD:
            return true; // Has card number, PIN
          case PASSWORD_CATEGORIES.ADDRESS:
            return false; // No sensitive data by default
          case PASSWORD_CATEGORIES.OTHER:
            return (item as OtherPassword).customFields.some(f => f.isSecret); // Check for secret fields
          default:
            return false;
        }
      };
      
      return (
        <View style={styles.passwordActions}>
          {hasToggleableContent() && (
            <TouchableOpacity 
              onPress={() => togglePasswordVisibility(item.id)}
              style={styles.actionButton}
            >
              {showPasswords[item.id] ? (
                <EyeOff size={20} color="#6b7280" />
              ) : (
                <Eye size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => deletePassword(item.id)}
            style={styles.actionButton}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      );
    };
    
    return (
      <View style={styles.passwordItem}>
        {renderHeader()}
        <View style={styles.passwordContent}>
          {renderContent()}
          {renderNotes()}
          {renderActions()}
        </View>
      </View>
    );
  };

  // Render the hidden password items
  const renderHiddenItem: ListRenderItem<HiddenPassword> = ({ item }) => (
    <View style={styles.passwordItem}>
      <View style={styles.passwordHeader}>
        <Lock size={20} color="#f59e0b" />
        <Text style={styles.passwordTitle}>{item.title}</Text>
        {(item.hasCustomPassword || item.useBiometrics) && (
          <View style={styles.securityIndicator}>
            {item.useBiometrics && <Fingerprint size={16} color="#22c55e" />}
            {item.hasCustomPassword && <Lock size={16} color="#22c55e" />}
          </View>
        )}
      </View>
      <View style={styles.passwordContent}>
        <Text style={styles.fieldValue}>
          {showHiddenPasswords[item.id] ? item.password : '•'.repeat(Math.min(item.password.length, 12))}
        </Text>
        <View style={styles.passwordActions}>
          <TouchableOpacity 
            onPress={() => (item.hasCustomPassword || item.useBiometrics) ? 
              handleViewSecuredPassword(item.id) : 
              toggleHiddenPasswordVisibility(item.id)}
            style={styles.actionButton}
          >
            {showHiddenPasswords[item.id] ? (
              <EyeOff size={20} color="#6b7280" />
            ) : (
              <Eye size={20} color="#6b7280" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => openSecuritySettings(item.id)}
            style={styles.actionButton}
          >
            {item.hasCustomPassword || item.useBiometrics ? (
              <Lock size={20} color="#22c55e" />
            ) : (
              <Lock size={20} color="#6b7280" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => deleteHiddenPassword(item.id)}
            style={styles.actionButton}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render the appropriate form based on the active category
  const renderAddForm = () => {
    switch (activeCategory) {
      case PASSWORD_CATEGORIES.LOGIN:
        return (
          <View style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Login</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={loginTitle}
              onChangeText={setLoginTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#6b7280"
              value={loginUsername}
              onChangeText={setLoginUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Website (optional)"
              placeholderTextColor="#6b7280"
              value={loginWebsite}
              onChangeText={setLoginWebsite}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={loginNotes}
              onChangeText={setLoginNotes}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Login</Text>
            </TouchableOpacity>
          </View>
        );
        
      case PASSWORD_CATEGORIES.SOCIAL:
        return (
          <View style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Social Media Account</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={socialTitle}
              onChangeText={setSocialTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Platform (e.g., Facebook, Twitter)"
              placeholderTextColor="#6b7280"
              value={socialPlatform}
              onChangeText={setSocialPlatform}
            />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#6b7280"
              value={socialUsername}
              onChangeText={setSocialUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={socialPassword}
              onChangeText={setSocialPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Profile URL (optional)"
              placeholderTextColor="#6b7280"
              value={socialProfileUrl}
              onChangeText={setSocialProfileUrl}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={socialNotes}
              onChangeText={setSocialNotes}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Social Account</Text>
            </TouchableOpacity>
          </View>
        );
        
      case PASSWORD_CATEGORIES.CARD:
        return (
          <View style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Card</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={cardTitle}
              onChangeText={setCardTitle}
            />
            
            {/* Card Type Dropdown */}
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowCardTypeDropdown(!showCardTypeDropdown)}
            >
              <Text style={styles.dropdownButtonText}>{cardType || 'Select Card Type'}</Text>
            </TouchableOpacity>
            
            {showCardTypeDropdown && (
              <View style={styles.dropdownMenu}>
                {CARD_TYPES.map((type, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCardType(type);
                      setShowCardTypeDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      cardType === type && styles.dropdownItemTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <TextInput
              style={styles.input}
              placeholder="Card Number"
              placeholderTextColor="#6b7280"
              value={cardNumber}
              onChangeText={setCardNumber}
              keyboardType="numeric"
            />
            
            {/* Card Holder Name Input */}
            <TextInput
              style={styles.input}
              placeholder="Cardholder Name"
              placeholderTextColor="#6b7280"
              value={cardholderName}
              onChangeText={setCardholderName}
            />
            
            {/* Expiry Date Picker */}
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: cardExpiry ? '#fff' : '#6b7280' }}>
                {cardExpiry ? formatDate(cardExpiry) : 'Expiry Date'}
              </Text>
            </TouchableOpacity>
            
            {showDatePicker && (
  <View style={styles.datePickerContainer}>
    <View style={styles.datePickerHeader}>
      <Text style={styles.datePickerTitle}>Select Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
        <Text style={styles.datePickerCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
    
    <View style={styles.datePickerControls}>
      {/* Year picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Year</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={cardExpiry ? cardExpiry.getFullYear().toString() : new Date().getFullYear().toString()}
          onChangeText={(text) => {
            const year = parseInt(text);
            if (!isNaN(year) && text.length === 4) {
              const newDate = new Date(cardExpiry || new Date());
              newDate.setFullYear(year);
              setCardExpiry(newDate);
            }
          }}
          maxLength={4}
        />
      </View>
      
      {/* Month picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Month</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={cardExpiry ? (cardExpiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
          onChangeText={(text) => {
            const month = parseInt(text);
            if (!isNaN(month) && month >= 1 && month <= 12) {
              const newDate = new Date(cardExpiry || new Date());
              newDate.setMonth(month - 1);
              setCardExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
      
      {/* Day picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Day</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={cardExpiry ? cardExpiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
          onChangeText={(text) => {
            const day = parseInt(text);
            if (!isNaN(day) && day >= 1 && day <= 31) {
              const newDate = new Date(cardExpiry || new Date());
              newDate.setDate(day);
              setCardExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
    </View>
    
    <TouchableOpacity 
      style={styles.datePickerSaveButton}
      onPress={() => setShowDatePicker(false)}
    >
      <Text style={styles.datePickerSaveText}>Save</Text>
    </TouchableOpacity>
  </View>
)}
            
            {/* CVV Input */}
            <TextInput
              style={styles.input}
              placeholder="CVV"
              placeholderTextColor="#6b7280"
              value={cardCVV}
              onChangeText={setCardCVV}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
            
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={cardNotes}
              onChangeText={setCardNotes}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Card</Text>
            </TouchableOpacity>
          </View>
        );
        
      case PASSWORD_CATEGORIES.VOUCHER:
        return (
          <View style={styles.addContainer}>
                        <Text style={styles.formTitle}>Add Voucher</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={voucherTitle}
              onChangeText={setVoucherTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Store/Service"
              placeholderTextColor="#6b7280"
              value={voucherStore}
              onChangeText={setVoucherStore}
            />
            <TextInput
              style={styles.input}
              placeholder="Code"
              placeholderTextColor="#6b7280"
              value={voucherCode}
              onChangeText={setVoucherCode}
              secureTextEntry
            />
            
            {/* Value Input */}
            <TextInput
              style={styles.input}
              placeholder="Value (optional)"
              placeholderTextColor="#6b7280"
              value={voucherValue}
              onChangeText={setVoucherValue}
            />
            
            {/* Expiry Date Picker */}
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowVoucherDatePicker(true)}
            >
              <Text style={{ color: voucherExpiry ? '#fff' : '#6b7280' }}>
                {voucherExpiry ? formatDate(voucherExpiry) : 'Expiry Date (optional)'}
              </Text>
            </TouchableOpacity>
            

{showVoucherDatePicker && (
  <View style={styles.datePickerContainer}>
    <View style={styles.datePickerHeader}>
      <Text style={styles.datePickerTitle}>Select Date</Text>
      <TouchableOpacity onPress={() => setShowVoucherDatePicker(false)}>
        <Text style={styles.datePickerCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
    
    <View style={styles.datePickerControls}>
      {/* Year picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Year</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={voucherExpiry ? voucherExpiry.getFullYear().toString() : new Date().getFullYear().toString()}
          onChangeText={(text) => {
            const year = parseInt(text);
            if (!isNaN(year) && text.length === 4) {
              const newDate = new Date(voucherExpiry || new Date());
              newDate.setFullYear(year);
              setVoucherExpiry(newDate);
            }
          }}
          maxLength={4}
        />
      </View>
      
      {/* Month picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Month</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={voucherExpiry ? (voucherExpiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
          onChangeText={(text) => {
            const month = parseInt(text);
            if (!isNaN(month) && month >= 1 && month <= 12) {
              const newDate = new Date(voucherExpiry || new Date());
              newDate.setMonth(month - 1);
              setVoucherExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
      
      {/* Day picker */}
      <View style={styles.datePickerField}>
        <Text style={styles.datePickerLabel}>Day</Text>
        <TextInput
          style={styles.datePickerInput}
          keyboardType="number-pad"
          value={voucherExpiry ? voucherExpiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
          onChangeText={(text) => {
            const day = parseInt(text);
            if (!isNaN(day) && day >= 1 && day <= 31) {
              const newDate = new Date(voucherExpiry || new Date());
              newDate.setDate(day);
              setVoucherExpiry(newDate);
            }
          }}
          maxLength={2}
        />
      </View>
    </View>
    
    <TouchableOpacity 
      style={styles.datePickerSaveButton}
      onPress={() => setShowVoucherDatePicker(false)}
    >
      <Text style={styles.datePickerSaveText}>Save</Text>
    </TouchableOpacity>
  </View>
)}
            
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={voucherNotes}
              onChangeText={setVoucherNotes}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Voucher</Text>
            </TouchableOpacity>
          </View>
        );
        
      case PASSWORD_CATEGORIES.GIFT_CARD:
        return (
          <View style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Gift Card</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={giftCardTitle}
              onChangeText={setGiftCardTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Store"
              placeholderTextColor="#6b7280"
              value={giftCardStore}
              onChangeText={setGiftCardStore}
            />
            <TextInput
              style={styles.input}
              placeholder="Card Number"
              placeholderTextColor="#6b7280"
              value={giftCardNumber}
              onChangeText={setGiftCardNumber}
              secureTextEntry
            />
            
            {/* PIN Input */}
            <TextInput
              style={styles.input}
              placeholder="PIN (optional)"
              placeholderTextColor="#6b7280"
              value={giftCardPin}
              onChangeText={setGiftCardPin}
              secureTextEntry
              keyboardType="numeric"
            />
            
            {/* Balance Input */}
            <TextInput
              style={styles.input}
              placeholder="Balance (optional)"
              placeholderTextColor="#6b7280"
              value={giftCardBalance}
              onChangeText={setGiftCardBalance}
              keyboardType="numeric"
            />
            
            {/* Expiry Date Picker */}
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowGiftCardDatePicker(true)}
            >
              <Text style={{ color: giftCardExpiry ? '#fff' : '#6b7280' }}>
                {giftCardExpiry ? formatDate(giftCardExpiry) : 'Expiry Date (optional)'}
              </Text>
            </TouchableOpacity>
            

            {showGiftCardDatePicker && (
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowGiftCardDatePicker(false)}>
                    <Text style={styles.datePickerCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.datePickerControls}>
                  {/* Year picker */}
                  <View style={styles.datePickerField}>
                    <Text style={styles.datePickerLabel}>Year</Text>
                    <TextInput
                      style={styles.datePickerInput}
                      keyboardType="number-pad"
                      value={giftCardExpiry ? giftCardExpiry.getFullYear().toString() : new Date().getFullYear().toString()}
                      onChangeText={(text) => {
                        const year = parseInt(text);
                        if (!isNaN(year) && text.length === 4) {
                          const newDate = new Date(giftCardExpiry || new Date());
                          newDate.setFullYear(year);
                          setGiftCardExpiry(newDate);
                        }
                      }}
                      maxLength={4}
                    />
                  </View>
                  
                  {/* Month picker */}
                  <View style={styles.datePickerField}>
                    <Text style={styles.datePickerLabel}>Month</Text>
                    <TextInput
                      style={styles.datePickerInput}
                      keyboardType="number-pad"
                      value={giftCardExpiry ? (giftCardExpiry.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0')}
                      onChangeText={(text) => {
                        const month = parseInt(text);
                        if (!isNaN(month) && month >= 1 && month <= 12) {
                          const newDate = new Date(giftCardExpiry || new Date());
                          newDate.setMonth(month - 1);
                          setGiftCardExpiry(newDate);
                        }
                      }}
                      maxLength={2}
                    />
                  </View>
                  
                  {/* Day picker */}
                  <View style={styles.datePickerField}>
                    <Text style={styles.datePickerLabel}>Day</Text>
                    <TextInput
                      style={styles.datePickerInput}
                      keyboardType="number-pad"
                      value={giftCardExpiry ? giftCardExpiry.getDate().toString().padStart(2, '0') : new Date().getDate().toString().padStart(2, '0')}
                      onChangeText={(text) => {
                        const day = parseInt(text);
                        if (!isNaN(day) && day >= 1 && day <= 31) {
                          const newDate = new Date(giftCardExpiry || new Date());
                          newDate.setDate(day);
                          setGiftCardExpiry(newDate);
                        }
                      }}
                      maxLength={2}
                    />
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.datePickerSaveButton}
                  onPress={() => setShowGiftCardDatePicker(false)}
                >
                  <Text style={styles.datePickerSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={giftCardNotes}
              onChangeText={setGiftCardNotes}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Gift Card</Text>
            </TouchableOpacity>
          </View>
        );
        
      case PASSWORD_CATEGORIES.ADDRESS:
        return (
          <ScrollView style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={addressTitle}
              onChangeText={setAddressTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#6b7280"
              value={addressFullName}
              onChangeText={setAddressFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Street Address"
              placeholderTextColor="#6b7280"
              value={addressStreet}
              onChangeText={setAddressStreet}
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#6b7280"
              value={addressCity}
              onChangeText={setAddressCity}
            />
            <TextInput
              style={styles.input}
              placeholder="State/Province"
              placeholderTextColor="#6b7280"
              value={addressState}
              onChangeText={setAddressState}
            />
            <TextInput
              style={styles.input}
              placeholder="ZIP/Postal Code"
              placeholderTextColor="#6b7280"
              value={addressZipCode}
              onChangeText={setAddressZipCode}
            />
            <TextInput
              style={styles.input}
              placeholder="Country"
              placeholderTextColor="#6b7280"
              value={addressCountry}
              onChangeText={setAddressCountry}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number (optional)"
              placeholderTextColor="#6b7280"
              value={addressPhone}
              onChangeText={setAddressPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email (optional)"
              placeholderTextColor="#6b7280"
              value={addressEmail}
              onChangeText={setAddressEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={addressNotes}
              onChangeText={setAddressNotes}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Address</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      
      case PASSWORD_CATEGORIES.OTHER:
        return (
          <ScrollView style={styles.addContainer}>
            <Text style={styles.formTitle}>Add Other Item</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6b7280"
              value={otherTitle}
              onChangeText={setOtherTitle}
            />
            
            {/* Custom Fields */}
            <Text style={styles.sectionLabel}>Custom Fields</Text>
            {otherCustomFields.map((field, index) => (
              <View key={index} style={styles.customFieldContainer}>
                <View style={styles.customFieldRow}>
                  <TextInput
                    style={[styles.input, styles.customFieldInput]}
                    placeholder="Label"
                    placeholderTextColor="#6b7280"
                    value={field.label}
                    onChangeText={(text) => updateCustomField(index, 'label', text)}
                  />
                  <TextInput
                    style={[styles.input, styles.customFieldInput]}
                    placeholder="Value"
                    placeholderTextColor="#6b7280"
                    value={field.value}
                    onChangeText={(text) => updateCustomField(index, 'value', text)}
                    secureTextEntry={field.isSecret}
                  />
                </View>
                <View style={styles.customFieldOptions}>
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Secret</Text>
                    <Switch
                      value={field.isSecret}
                      onValueChange={(value) => updateCustomField(index, 'isSecret', value)}
                      trackColor={{ false: "#3f3f46", true: "#4f46e5" }}
                      thumbColor={field.isSecret ? "#ffffff" : "#9ca3af"}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.removeFieldButton}
                    onPress={() => handleRemoveCustomField(index)}
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.addFieldButton}
              onPress={handleAddCustomField}
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.addFieldButtonText}>Add Custom Field</Text>
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              value={otherNotes}
              onChangeText={setOtherNotes}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleAddPassword}
            >
              <Text style={styles.saveButtonText}>Save Item</Text>
            </TouchableOpacity>
          </ScrollView>
        );
        
      default:
        return (
          <View style={styles.addContainer}>
            <Text style={styles.errorText}>Unknown category selected.</Text>
          </View>
        );
    }
  };

  // Filter passwords by category
  const filteredPasswords = useMemo(() => {
    // Use fake passwords in duress mode, otherwise use real passwords
    const dataSource = duressMode && duressEnabled ? fakePasswords : passwords;
    
    return dataSource.filter(pwd => {
      // Make case-insensitive comparison and handle missing categories
      if (!pwd.category) return activeCategory === PASSWORD_CATEGORIES.LOGIN; // Default to LOGIN
      return pwd.category.toLowerCase() === activeCategory.toLowerCase();
    });
  }, [activeCategory, passwords, fakePasswords, duressMode, duressEnabled]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading passwords...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Category Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.LOGIN && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.LOGIN)}
        >
          <Key size={18} color={activeCategory === PASSWORD_CATEGORIES.LOGIN ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.LOGIN && styles.activeCategoryTabText
          ]}>
            Logins
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.SOCIAL && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.SOCIAL)}
        >
          <Share2 size={18} color={activeCategory === PASSWORD_CATEGORIES.SOCIAL ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.SOCIAL && styles.activeCategoryTabText
          ]}>
            Social
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.CARD && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.CARD)}
        >
          <CreditCard size={18} color={activeCategory === PASSWORD_CATEGORIES.CARD ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.CARD && styles.activeCategoryTabText
          ]}>
            Cards
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.VOUCHER && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.VOUCHER)}
        >
          <Tag size={18} color={activeCategory === PASSWORD_CATEGORIES.VOUCHER ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.VOUCHER && styles.activeCategoryTabText
          ]}>
            Vouchers
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.GIFT_CARD && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.GIFT_CARD)}
        >
          <Gift size={18} color={activeCategory === PASSWORD_CATEGORIES.GIFT_CARD ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.GIFT_CARD && styles.activeCategoryTabText
          ]}>
            Gift Cards
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.categoryTab,
            activeCategory === PASSWORD_CATEGORIES.ADDRESS && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory(PASSWORD_CATEGORIES.ADDRESS)}
        >
          <MapPin size={18} color={activeCategory === PASSWORD_CATEGORIES.ADDRESS ? "#fff" : "#9ca3af"} />
          <Text style={[
            styles.categoryTabText,
            activeCategory === PASSWORD_CATEGORIES.ADDRESS && styles.activeCategoryTabText
          ]}>
            Addresses
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
                    style={[
                      styles.categoryTab,
                      activeCategory === PASSWORD_CATEGORIES.OTHER && styles.activeCategoryTab
                    ]}
                    onPress={() => setActiveCategory(PASSWORD_CATEGORIES.OTHER)}
                  >
                    <FileText size={18} color={activeCategory === PASSWORD_CATEGORIES.OTHER ? "#fff" : "#9ca3af"} />
                    <Text style={[
                      styles.categoryTabText,
                      activeCategory === PASSWORD_CATEGORIES.OTHER && styles.activeCategoryTabText
                    ]}>
                      Other
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
          
                <View style={styles.header}>
                  <Pressable onPress={handleSecretTap}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={styles.title}>{getCategoryTitle(activeCategory)}</Text>
                      {duressMode && duressEnabled && (
                        <View style={styles.duressIndicator} />
                      )}
                    </View>
                  </Pressable>
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => setShowAdd(!showAdd)}
                  >
                    <Plus size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
          
                {showAdd && renderAddForm(activeCategory)}
                
                <FlatList<Password>
                  data={filteredPasswords}
                  renderItem={renderItem}
                  keyExtractor={(item) => item?.id || String(Math.random())}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl 
                      refreshing={refreshing} 
                      onRefresh={onRefresh} 
                      colors={['#4F46E5']} 
                      tintColor="#4F46E5"
                      title="Refreshing..."
                      titleColor="#9ca3af"
                    />
                  }
                />
                
                {filteredPasswords.length === 0 && !refreshing && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No {getCategoryTitle(activeCategory).toLowerCase()} saved yet. Tap the + button to add one.
                    </Text>
                  </View>
                )}
                
                {/* Hidden Feature Setup Modal */}
                <Modal
                  visible={setupHidden}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setSetupHidden(false)}
                >
                  <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>Enable Hidden Passwords</Text>
                      <Text style={styles.modalDescription}>
                        Set a keyword to access your hidden passwords. You will need to enter this keyword as a title in the add password form to access your hidden passwords.
                      </Text>
                      
                      <TextInput
                        style={styles.input}
                        placeholder="Enter keyword"
                        placeholderTextColor="#6b7280"
                        value={newHiddenKeyword}
                        onChangeText={setNewHiddenKeyword}
                      />
                      
                      <View style={styles.modalButtonsRow}>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.cancelButton]}
                          onPress={() => setSetupHidden(false)}
                        >
                          <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.confirmButton]}
                          onPress={enableHiddenFeature}
                        >
                          <Text style={styles.modalButtonText}>Enable</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
                
                {/* Hidden Passwords Modal */}
                <Modal
                  visible={showHiddenModal}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setShowHiddenModal(false)}
                >
                  <View style={styles.modalContainer}>
                    <View style={styles.hiddenModalContent}>
                      <View style={styles.hiddenHeader}>
                        <Text style={styles.modalTitle}>Hidden Passwords</Text>
                        <TouchableOpacity 
                          style={styles.closeButton}
                          onPress={() => setShowHiddenModal(false)}
                        >
                          <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.hiddenActions}>
                        <TouchableOpacity 
                          style={styles.addHiddenButton}
                          onPress={() => setShowHiddenAdd(!showHiddenAdd)}
                        >
                          <Plus size={20} color="#fff" />
                          <Text style={styles.addHiddenButtonText}>Add</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.deleteAllButton}
                          onPress={deleteAllHiddenPasswords}
                        >
                          <Trash2 size={20} color="#fff" />
                          <Text style={styles.deleteAllButtonText}>Delete All</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {showHiddenAdd && (
                        <View style={styles.addHiddenContainer}>
                          <TextInput
                            style={styles.input}
                            placeholder="Title"
                            placeholderTextColor="#6b7280"
                            value={newHiddenTitle}
                            onChangeText={setNewHiddenTitle}
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#6b7280"
                            value={newHiddenPassword}
                            onChangeText={setNewHiddenPassword}
                            secureTextEntry
                          />
                          <TouchableOpacity 
                            style={styles.saveButton}
                            onPress={addHiddenPassword}
                          >
                            <Text style={styles.saveButtonText}>Save Hidden Password</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      <FlatList
                        data={hiddenPasswords}
                        renderItem={renderHiddenItem}
                        keyExtractor={item => item.id}
                        style={styles.hiddenList}
                        contentContainerStyle={styles.listContent}
                      />
                      
                      {hiddenPasswords.length === 0 && (
                        <View style={styles.emptyState}>
                          <Text style={styles.emptyStateText}>
                            No hidden passwords yet. Add one to get started.
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>
          
                {/* Password Security Modal */}
                <Modal
                  visible={showPasswordSecurityModal}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setShowPasswordSecurityModal(false)}
                >
                  <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                      {/* Security settings modal */}
                      <Text style={styles.modalTitle}>Password Security</Text>
                      
                      <View style={styles.securityOption}>
                        <Text style={styles.securityOptionText}>Require password</Text>
                        <Switch
                          value={useCustomPassword}
                          onValueChange={setUseCustomPassword}
                          trackColor={{ false: "#3f3f46", true: "#4f46e5" }}
                          thumbColor={useCustomPassword ? "#ffffff" : "#9ca3af"}
                        />
                      </View>
                      
                      {useCustomPassword && (
                        <TextInput
                          style={styles.input}
                          placeholder="Set password"
                          placeholderTextColor="#6b7280"
                          value={customPasswordForHidden}
                          onChangeText={setCustomPasswordForHidden}
                          secureTextEntry
                        />
                      )}
                      
                      {biometricsSupported && (
                        <View style={styles.securityOption}>
                          <Text style={styles.securityOptionText}>Use biometrics</Text>
                          <Switch
                            value={useBiometrics}
                            onValueChange={setUseBiometrics}
                            trackColor={{ false: "#3f3f46", true: "#4f46e5" }}
                            thumbColor={useBiometrics ? "#ffffff" : "#9ca3af"}
                          />
                        </View>
                      )}
                      
                      {useCustomPassword && useBiometrics && (
                        <Text style={styles.securityNote}>
                          Both password and biometrics will be required to access this password.
                        </Text>
                      )}
                      
                      <View style={styles.modalButtonsRow}>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.cancelButton]}
                          onPress={() => setShowPasswordSecurityModal(false)}
                        >
                          <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.confirmButton]}
                          onPress={saveSecuritySettings}
                        >
                          <Text style={styles.modalButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
          
                {/* Password Authentication Modal */}
                <Modal
                  visible={passwordAuthModal}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setPasswordAuthModal(false)}
                >
                  <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>Enter Password</Text>
                      <Text style={styles.modalDescription}>
                        This password is protected. Enter the password to view it.
                      </Text>
                      
                      <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#6b7280"
                        value={passwordToVerify}
                        onChangeText={setPasswordToVerify}
                        secureTextEntry
                        autoFocus
                      />
                      
                      <View style={styles.modalButtonsRow}>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.cancelButton]}
                          onPress={() => {
                            setPasswordAuthModal(false);
                            setSelectedPasswordId(null);
                          }}
                        >
                          <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.confirmButton]}
                          onPress={verifyCustomPassword}
                        >
                          <Text style={styles.modalButtonText}>Verify</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              </KeyboardAvoidingView>
            );
          }
          
// Helper function to get a readable title for each category
const getCategoryTitle = (category: string): string => {
  switch (category) {
    case PASSWORD_CATEGORIES.LOGIN:
      return 'Logins';
    case PASSWORD_CATEGORIES.SOCIAL:
      return 'Social Media';
    case PASSWORD_CATEGORIES.CARD:
      return 'Cards';
    case PASSWORD_CATEGORIES.VOUCHER:
      return 'Vouchers';
    case PASSWORD_CATEGORIES.GIFT_CARD:
      return 'Gift Cards';
    case PASSWORD_CATEGORIES.ADDRESS:
      return 'Addresses';
    case PASSWORD_CATEGORIES.OTHER:
      return 'Other Items';
    default:
      return 'Passwords';
  }
};

          
const styles = StyleSheet.create({
securityIndicator: {
  flexDirection: 'row',
  marginLeft: 8,
  gap: 4,
},
securityOption: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginVertical: 12,
},
securityOptionText: {
  color: '#fff',
  fontSize: 16,
},
centered: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
},
loadingText: {
  color: '#fff',
  marginTop: 16,
  fontSize: 16,
},
container: {
  flex: 1,
  backgroundColor: '#1a1b1e',
},
categoryTabs: {
  maxHeight: 50,
  backgroundColor: '#27272a',
  borderBottomWidth: 1,
  borderBottomColor: '#374151',
},
categoryTabsContent: {
  paddingHorizontal: 10,
},
categoryTab: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginHorizontal: 4,
  borderRadius: 8,
  gap: 6,
},
activeCategoryTab: {
  backgroundColor: '#4F46E5',
},
categoryTabText: {
  color: '#9ca3af',
  fontSize: 14,
  fontWeight: '500',
},
activeCategoryTabText: {
  color: '#fff',
},
header: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
},
title: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#fff',
},
formTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#fff',
  marginBottom: 12,
},
addButton: {
  backgroundColor: '#4F46E5',
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
addContainer: {
  backgroundColor: '#27272a',
  padding: 20,
  margin: 20,
  borderRadius: 12,
  gap: 12,
},
input: {
  backgroundColor: '#1a1b1e',
  padding: 12,
  borderRadius: 8,
  color: '#fff',
  fontSize: 16,
  marginBottom: 8,
},
notesInput: {
  height: 80,
  textAlignVertical: 'top',
},
saveButton: {
  backgroundColor: '#4F46E5',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
},
saveButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '500',
},
list: {
  flex: 1,
},
listContent: {
  padding: 20,
  gap: 12,
},
passwordItem: {
  backgroundColor: '#27272a',
  padding: 16,
  borderRadius: 12,
  gap: 12,
},
passwordHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
passwordTitle: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '500',
},
passwordContent: {
  gap: 8,
},
fieldRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 4,
},
fieldLabel: {
  color: '#9ca3af',
  fontSize: 14,
  flex: 1,
},
fieldValue: {
  color: '#fff',
  fontSize: 14,
  flex: 2,
},
notesContainer: {
  marginTop: 8,
  padding: 8,
  backgroundColor: '#1a1b1e',
  borderRadius: 8,
},
notesLabel: {
  color: '#9ca3af',
  fontSize: 14,
  marginBottom: 4,
},
notesText: {
  color: '#e5e7eb',
  fontSize: 14,
},
emptyState: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
},
emptyStateText: {
  color: '#6b7280',
  fontSize: 16,
  textAlign: 'center',
},
eyeButton: {
  padding: 8,  // Add some padding for better touch target
},
passwordActions: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#374151',
  marginTop: 8,
},
actionButton: {
  padding: 8,
  borderRadius: 8,
},
// Modal styles
modalContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
},
modalContent: {
  backgroundColor: '#27272a',
  padding: 20,
  borderRadius: 12,
  width: '85%',
  maxWidth: 400,
},
modalTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#fff',
  marginBottom: 10,
},
modalDescription: {
  fontSize: 14,
  color: '#9ca3af',
  marginBottom: 20,
},
modalButtonsRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 10,
},
modalButton: {
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  flex: 1,
  marginHorizontal: 5,
},
cancelButton: {
  backgroundColor: '#374151',
},
confirmButton: {
  backgroundColor: '#4F46E5',
},
modalButtonText: {
  color: '#fff',
  fontWeight: '500',
},
// Hidden passwords modal styles
hiddenModalContent: {
  backgroundColor: '#27272a',
  borderRadius: 12,
  width: '90%',
  maxWidth: 500,
  height: '80%',
  maxHeight: 600,
},
hiddenHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#374151',
},
closeButton: {
  padding: 5,
},
closeButtonText: {
  color: '#9ca3af',
  fontSize: 20,
},
hiddenActions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 20,
},
addHiddenButton: {
  backgroundColor: '#4F46E5',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  gap: 8,
},
addHiddenButtonText: {
  color: '#fff',
  fontWeight: '500',
},
deleteAllButton: {
  backgroundColor: '#dc2626',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  gap: 8,
},
deleteAllButtonText: {
  color: '#fff',
  fontWeight: '500',
},
addHiddenContainer: {
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#374151',
  gap: 12,
},
hiddenList: {
  flex: 1,
},
securityNote: {
  color: '#f59e0b',
  fontSize: 14,
  marginVertical: 8,
  fontStyle: 'italic',
},
// Dropdown styles
dropdownButton: {
  backgroundColor: '#1a1b1e',
  padding: 12,
  borderRadius: 8,
  marginBottom: 8,
},
dropdownButtonText: {
  color: '#fff',
  fontSize: 16,
},
dropdownMenu: {
  backgroundColor: '#1a1b1e',
  borderRadius: 8,
  marginBottom: 8,
  padding: 4,
  borderWidth: 1,
  borderColor: '#374151',
},
dropdownItem: {
  padding: 12,
  borderRadius: 4,
},
dropdownItemText: {
  color: '#fff',
  fontSize: 16,
},
dropdownItemTextSelected: {
  color: '#4F46E5',
  fontWeight: 'bold',
},
// Custom field styles
sectionLabel: {
  color: '#fff',
  fontSize: 18,
  fontWeight: '500',
  marginVertical: 10,
},
customFieldContainer: {
  backgroundColor: '#1a1b1e',
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
},
customFieldRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 8,
},
customFieldInput: {
  flex: 1,
  marginBottom: 0,
},
customFieldOptions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
switchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
switchLabel: {
  color: '#9ca3af',
  fontSize: 14,
},
removeFieldButton: {
  padding: 8,
  borderRadius: 8,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
},
addFieldButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#374151',
  padding: 12,
  borderRadius: 8,
  gap: 8,
  marginBottom: 12,
},
addFieldButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '500',
},
errorText: {
  color: '#ef4444',
  fontSize: 16,
  textAlign: 'center',
},
// Add to your styles object

datePickerContainer: {
  backgroundColor: '#27272a',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
},
datePickerHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 16,
},
datePickerTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#fff',
},
datePickerCloseText: {
  color: '#4F46E5',
  fontSize: 16,
},
datePickerControls: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 16,
},
datePickerField: {
  flex: 1,
  marginHorizontal: 4,
},
datePickerLabel: {
  color: '#9ca3af',
  marginBottom: 4,
},
datePickerInput: {
  backgroundColor: '#1a1b1e',
  padding: 12,
  borderRadius: 8,
  color: '#fff',
  fontSize: 16,
  textAlign: 'center',
},
datePickerSaveButton: {
  backgroundColor: '#4F46E5',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
},
datePickerSaveText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '500',
},
securityToggle: {
  backgroundColor: '#27272a',
  padding: 16,
  borderRadius: 12,
  marginBottom: 12,
},
duressIndicator: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: '#ef4444',
  marginLeft: 6,
  opacity: 0.7,
},
websiteLink: {
  flex: 2,
},
websiteLinkText: {
  color: '#4F46E5',
  fontSize: 14,
  textDecorationLine: 'underline',
},
});

export default PasswordsTab;