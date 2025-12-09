const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const List = sequelize.define('List', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  boardId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Board',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
});

module.exports = List;
